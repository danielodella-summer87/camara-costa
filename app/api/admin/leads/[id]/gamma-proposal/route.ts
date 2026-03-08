import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { getAllowedLeadProfilesByRole, getRoleNameByRoleId } from "@/lib/rbac/leadProfiles";
import { createGammaFromTemplate, type GammaProfile } from "@/lib/integrations/gamma";
import {
  getGammaPromptProfile,
  buildGammaCommercialPrompt,
  buildGammaTechnicalPrompt,
  type GammaPromptContext,
} from "@/lib/ai/gammaPromptProfiles";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(req, "leads.read");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const profile = (body?.profile === "tecnico" ? "tecnico" : "comercial") as GammaProfile;
    const requestedProfile = profile;

    const sb = supabaseAdmin();
    const roleName = await getRoleNameByRoleId(sb, user.role_id);
    const allowedProfiles = getAllowedLeadProfilesByRole(roleName);
    if (!allowedProfiles.includes(requestedProfile)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[PROFILE FORBIDDEN]", { role: roleName, requestedProfile, allowedProfiles });
      }
      return NextResponse.json(
        { ok: false, error: `No autorizado para usar el perfil ${requestedProfile === "tecnico" ? "tecnico" : "comercial"}.` },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const { data: leadRow, error: leadErr } = await sb
      .from("leads")
      .select(
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_report,empresa_id,empresas:empresa_id(id,nombre,email,telefono,celular,web,instagram,facebook,direccion,ciudad,pais,rubro_id,rubros:rubro_id(nombre))"
      )
      .eq("id", id)
      .maybeSingle();

    if (leadErr) throw new Error(leadErr.message);
    if (!leadRow) {
      return NextResponse.json({ ok: false, error: "Lead no encontrado" }, { status: 404 });
    }

    const lead = leadRow as any;
    const empresa = lead?.empresas ?? null;
    const rubro = (empresa as any)?.rubros as { nombre?: string } | null;

    let contacts: Array<{ nombre?: string; cargo?: string | null; telefono?: string | null; email?: string | null }> = [];
    try {
      const { data: contactsData } = await sb
        .from("lead_contacts")
        .select("nombre,cargo,telefono,email")
        .eq("lead_id", id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (contactsData?.length) contacts = contactsData as typeof contacts;
    } catch {
      // ignorar
    }

    const reportProfile = getGammaPromptProfile(profile);
    const aiReport = (lead.ai_report && String(lead.ai_report).trim()) || "Sin informe IA generado aún.";

    const ctx: GammaPromptContext = {
      lead: {
        nombre: lead.nombre,
        objetivos: lead.objetivos,
        audiencia: lead.audiencia,
        tamano: lead.tamano,
        oferta: lead.oferta,
        notas: lead.notas,
        origen: lead.origen,
        pipeline: lead.pipeline,
        website: lead.website,
      },
      empresa: empresa
        ? {
            nombre: empresa.nombre,
            web: empresa.web,
            email: empresa.email,
            telefono: empresa.telefono,
            direccion: empresa.direccion,
            ciudad: empresa.ciudad,
            pais: empresa.pais,
            instagram: empresa.instagram,
            facebook: empresa.facebook,
            rubroNombre: rubro?.nombre ?? null,
          }
        : null,
      contactos: contacts,
      aiReport,
      reportProfile,
    };

    const prompt =
      profile === "tecnico" ? buildGammaTechnicalPrompt(ctx) : buildGammaCommercialPrompt(ctx);

    const { generationId } = await createGammaFromTemplate({ profile, prompt });

    if (process.env.NODE_ENV !== "production") {
      const templateId = profile === "comercial" ? "g_eei2ys2xo99qpqa" : "g_bsbasmgzmqqryc1";
      console.log("[GAMMA create]", { profile, templateId, generationId });
    }

    return NextResponse.json({
      ok: true,
      profile,
      generationId,
      status: "pending",
    });
  } catch (e: any) {
    console.error("[GAMMA] Error:", e?.message ?? e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error generando propuesta Gamma" },
      { status: 500 }
    );
  }
}
