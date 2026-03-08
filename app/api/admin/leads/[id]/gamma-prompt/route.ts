import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGammaPromptProfile } from "@/lib/ai/gammaPromptProfiles";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { getAllowedLeadProfilesByRole, getRoleNameByRoleId } from "@/lib/rbac/leadProfiles";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeStr(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

/** Recorta el informe IA para no exceder contexto (primeros ~6000 caracteres por sección lógica) */
function summarizeAiReport(aiReport: string | null | undefined, maxChars = 8000): string {
  if (!aiReport || !aiReport.trim()) return "Sin informe IA generado aún.";
  const raw = aiReport.trim();
  if (raw.length <= maxChars) return raw;
  return raw.slice(0, maxChars) + "\n\n[... informe truncado para el prompt ...]";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(req, "leads.read");
    if (!user) {
      return NextResponse.json({ data: null, error: "No autorizado" }, { status: 403 });
    }

    const sb = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") === "tecnico" ? "tecnico" : "comercial") as "comercial" | "tecnico";
    const requestedProfile = type;

    const roleName = await getRoleNameByRoleId(sb, user.role_id);
    const allowedProfiles = getAllowedLeadProfilesByRole(roleName);
    if (!allowedProfiles.includes(requestedProfile)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[PROFILE FORBIDDEN]", { role: roleName, requestedProfile, allowedProfiles });
      }
      return NextResponse.json(
        { data: null, error: `No autorizado para usar el perfil ${requestedProfile === "tecnico" ? "tecnico" : "comercial"}.` },
        { status: 403 }
      );
    }

    const profile = getGammaPromptProfile(type);

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ data: null, error: "id requerido" }, { status: 400 });
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
      return NextResponse.json({ data: null, error: "Lead no encontrado" }, { status: 404 });
    }

    const lead = leadRow as any;
    const empresa = lead?.empresas ?? null;
    const rubro = (empresa as any)?.rubros as { nombre?: string } | null;
    const rubroNombre = rubro?.nombre ?? "";

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

    const aiReport = summarizeAiReport(lead.ai_report);

    const lines: string[] = [];

    lines.push(`# Prompt para Gamma – ${profile.label}`);
    lines.push("");
    lines.push("Genera una presentación con la siguiente información y estructura.");
    lines.push("");
    lines.push("---");
    lines.push("## INSTRUCCIONES DE ESTRUCTURA");
    lines.push("");
    profile.sections.forEach((section, i) => {
      lines.push(`${i + 1}. ${section}`);
    });
    lines.push("");
    lines.push(`**Tono:** ${profile.tone}`);
    if (profile.cta) lines.push(`**CTA:** ${profile.cta}`);
    lines.push("");
    lines.push("---");
    lines.push("## DATOS DEL LEAD Y EMPRESA");
    lines.push("");

    lines.push("### Empresa");
    lines.push(`- Nombre: ${safeStr(empresa?.nombre) || safeStr(lead.nombre) || "—"}`);
    lines.push(`- Rubro: ${safeStr(rubroNombre) || "—"}`);
    lines.push(`- Web: ${safeStr(empresa?.web) || "—"}`);
    lines.push(`- Email: ${safeStr(empresa?.email) || "—"}`);
    lines.push(`- Teléfono: ${safeStr(empresa?.telefono) || "—"}`);
    lines.push(`- Dirección: ${safeStr(empresa?.direccion) || "—"} ${safeStr(empresa?.ciudad) || ""} ${safeStr(empresa?.pais) || ""}`.trim());
    lines.push(`- Instagram: ${safeStr(empresa?.instagram) || "—"}`);
    lines.push(`- Facebook: ${safeStr(empresa?.facebook) || "—"}`);
    lines.push("");

    lines.push("### Contexto del negocio (datos nuevos del lead)");
    lines.push(`- Objetivos: ${safeStr(lead.objetivos) || "—"}`);
    lines.push(`- Audiencia / ¿Ya es cliente de la Agencia?: ${safeStr(lead.audiencia) || "—"}`);
    lines.push(`- Tamaño: ${safeStr(lead.tamano) || "—"}`);
    lines.push(`- Oferta / Notas de prensa: ${safeStr(lead.oferta) || "—"}`);
    lines.push(`- Notas: ${safeStr(lead.notas) || "—"}`);
    lines.push(`- Origen: ${safeStr(lead.origen) || "—"}`);
    lines.push(`- Pipeline: ${safeStr(lead.pipeline) || "—"}`);
    lines.push("");

    if (contacts.length > 0) {
      lines.push("### Contactos");
      contacts.forEach((c, i) => {
        lines.push(`${i + 1}. ${safeStr(c.nombre)}${c.cargo ? ` (${c.cargo})` : ""} – Tel: ${safeStr(c.telefono) || "—"} – Email: ${safeStr(c.email) || "—"}`);
      });
      lines.push("");
    }

    lines.push("---");
    lines.push("## INFORME IA (resumen para la presentación)");
    lines.push("");
    lines.push(aiReport);
    lines.push("");
    lines.push("---");
    lines.push("Usa la estructura indicada arriba y genera slides con tono premium. El contenido debe estar listo para presentar a la empresa.");

    const prompt = lines.join("\n");

    return NextResponse.json(
      { data: { prompt }, error: null },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error generando prompt Gamma" },
      { status: 500 }
    );
  }
}
