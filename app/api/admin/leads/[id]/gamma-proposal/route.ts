import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { getAllowedLeadProfilesByRole, getRoleNameByRoleId } from "@/lib/rbac/leadProfiles";
import { createGammaFromTemplate, type GammaProfile } from "@/lib/integrations/gamma";
import {
  getGammaPromptProfile,
  buildGammaCommercialPrompt,
  buildGammaTechnicalPrompt,
  buildGammaProPromptFromPayload,
  type GammaPromptContext,
  type ProposalPayloadForGamma,
} from "@/lib/ai/gammaPromptProfiles";
import { buildProposalExportPayload } from "@/lib/leads/proposalExportPayload";
import { LEAD_SERVICE_PROPOSALS_LIST_SELECT, mapLeadServiceProposalRows } from "@/lib/leads/mapLeadServiceProposalRows";

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
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_report,proposal_draft_json,proposal_confirmed_at,empresa_id,empresas:empresa_id(id,nombre,email,telefono,celular,web,instagram,facebook,direccion,ciudad,pais,rubro_id,rubros:rubro_id(nombre))"
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
    const proposalConfirmedAt = lead?.proposal_confirmed_at && String(lead.proposal_confirmed_at).trim() ? lead.proposal_confirmed_at : null;

    let leadServices = [] as ReturnType<typeof mapLeadServiceProposalRows>;
    try {
      const { data: svcRows } = await sb
        .from("lead_service_proposals")
        .select(LEAD_SERVICE_PROPOSALS_LIST_SELECT)
        .eq("lead_id", id)
        .order("mes", { ascending: true })
        .order("orden", { ascending: true });
      if (svcRows?.length) {
        leadServices = mapLeadServiceProposalRows(svcRows);
      }
    } catch {
      // ignorar
    }

    let prompt: string;

    if (profile === "comercial" && proposalConfirmedAt && leadServices.length > 0) {
      const payload = buildProposalExportPayload({
        lead: {
          id: lead.id,
          nombre: lead.nombre,
          website: lead.website,
          proposal_draft_json: lead.proposal_draft_json,
          proposal_confirmed_at: lead.proposal_confirmed_at,
          empresas: lead.empresas,
        },
        leadServices,
      });
      const gammaPayload: ProposalPayloadForGamma = {
        lead: {
          nombre: payload.lead.nombre,
          empresa: payload.lead.empresa,
          rubro: payload.lead.rubro,
          website: payload.lead.website,
        },
        proposal: payload.proposal,
        monthlyTable: payload.monthlyTable,
        services: payload.services.map((s) => ({
          codigo: s.codigo,
          nombre: s.nombre,
          monthlyValues: payload.monthlyTable?.rows.find((r) => r.proposalId === s.proposalId)?.monthlyValues ?? {},
          salesArgument: s.salesArgument,
          strategicReason: s.strategicReason,
        })),
        narrative: {
          summary: payload.narrative.summary,
          objectives: payload.narrative.objectives.length ? payload.narrative.objectives.join("\n") : "",
          whyNow: payload.narrative.whyNow,
          nextStep: payload.narrative.nextStep,
        },
        contact: {
          agencyName: payload.contact.agencyName,
          website: payload.contact.website,
          whatsapp: payload.contact.whatsapp,
        },
      };
      prompt = buildGammaProPromptFromPayload(gammaPayload);
      if (process.env.NODE_ENV !== "production") {
        console.log("[COMMERCIAL DOC] type: proposal");
        console.log("[COMMERCIAL DOC] prompt length:", prompt.length);
      }
    } else {
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
      prompt = profile === "tecnico" ? buildGammaTechnicalPrompt(ctx) : buildGammaCommercialPrompt(ctx);
    }

    const data = await createGammaFromTemplate({ profile, prompt });
    const generationId =
      (data && typeof data === "object" && (data.generationId ?? (data as { id?: string; generation_id?: string }).id ?? (data as { id?: string; generation_id?: string }).generation_id)) ?? null;
    if (!generationId || typeof generationId !== "string") {
      console.error("[GAMMA proposal] Respuesta sin generationId", data);
      return NextResponse.json(
        { ok: false, error: "No se pudo iniciar la generación del documento." },
        { status: 502 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      const templateId = profile === "comercial" ? "g_eei2ys2xo99qpqa" : "g_bsbasmgzmqqryc1";
      console.log("[GAMMA create]", { profile, templateId, generationId });
    }
    return NextResponse.json({
      ok: true,
      generationId,
      status: "pending",
    });
  } catch (e: any) {
    const responseText = e?.message ?? String(e);
    if (/GAMMA_API_KEY/i.test(responseText)) {
      console.error("[GAMMA] Configuración faltante:", responseText);
      return NextResponse.json(
        { ok: false, error: "El servicio de presentaciones no está disponible. Contacte al administrador del sistema." },
        { status: 503 }
      );
    }
    const isGammaTimeoutOrServerError =
      /cloudflare/i.test(responseText) ||
      /error code:\s*524/i.test(responseText) ||
      /<html/i.test(responseText);

    if (isGammaTimeoutOrServerError) {
      console.error("Gamma timeout or server error", responseText);
      return NextResponse.json(
        { ok: false, error: "Gamma tardó demasiado en responder. Intenta generar la presentación nuevamente." },
        { status: 502 }
      );
    }

    console.error("[GAMMA] Error:", responseText);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error generando propuesta Gamma" },
      { status: 500 }
    );
  }
}
