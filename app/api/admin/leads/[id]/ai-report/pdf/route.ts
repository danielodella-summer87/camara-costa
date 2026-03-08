import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getReportProfile } from "@/lib/ai/reportProfiles";
import LeadReportPdf from "@/components/pdf/LeadReportPdf";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { getAllowedLeadProfilesByRole, getRoleNameByRoleId } from "@/lib/rbac/leadProfiles";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Parsea el informe y extrae secciones por ### TAB: ID */
function parseReportTabs(aiReport: string): Record<string, string> {
  const tabs: Record<string, string> = {};
  if (!aiReport?.trim()) return tabs;
  const tabPattern = /###\s+TAB:\s*(\w+)\s*\n/gi;
  const matches: Array<{ tabId: string; startIndex: number }> = [];
  let match;
  while ((match = tabPattern.exec(aiReport)) !== null) {
    matches.push({ tabId: match[1], startIndex: match.index + match[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const startIndex = matches[i].startIndex;
    const remaining = aiReport.slice(startIndex);
    const nextTabMatch = remaining.match(/###\s+TAB:\s*\w+\s*\n/i);
    const endIndex = nextTabMatch && typeof nextTabMatch.index === "number"
      ? startIndex + nextTabMatch.index
      : aiReport.length;
    const content = aiReport.slice(startIndex, endIndex).trim();
    if (content) tabs[matches[i].tabId] = content;
  }
  return tabs;
}

/** Labels sin emoji para secciones del PDF */
const MODULE_LABELS: Record<string, string> = {
  INVESTIGACION_DIGITAL: "Investigación Digital",
  REDES_SOCIALES: "Redes Sociales",
  PAUTA_PUBLICITARIA: "Pauta Publicitaria",
  PRESTIGIO_IA: "Prestigio en IA",
  POSICIONAMIENTO: "Posicionamiento en el mercado",
  COMPETENCIA: "Competencia",
  FODA: "FODA",
  OPORTUNIDADES: "Oportunidades",
  ACCIONES: "Acciones",
  MATERIALES_LISTOS: "Materiales listos",
  CIERRE_VENTA: "Cierre de la venta",
  vision_estrategica: "Visión Estratégica",
  linkedin_decision_makers: "LinkedIn – Tomadores de decisión",
  north_star_metric: "North Star y métricas clave",
  producto_servicio_estrella: "Producto / Servicio estrella",
  auditoria_tecnica_basica: "Auditoría técnica básica",
  plan_crecimiento: "Plan de crecimiento",
  propuesta_easy: "Propuesta de crecimiento EASY",
  oportunidades_negocio_easy: "Oportunidades de negocio EASY",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(req, "leads.read");
    if (!user) {
      return new Response(JSON.stringify({ data: null, error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sb = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const profileId = String(searchParams.get("profile") ?? "comercial").trim().toLowerCase();
    const reportProfile = getReportProfile(profileId);
    const requestedProfile = reportProfile.id as "comercial" | "tecnico";

    const roleName = await getRoleNameByRoleId(sb, user.role_id);
    const allowedProfiles = getAllowedLeadProfilesByRole(roleName);
    if (!allowedProfiles.includes(requestedProfile)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[PROFILE FORBIDDEN]", { role: roleName, requestedProfile, allowedProfiles });
      }
      return new Response(
        JSON.stringify({ data: null, error: `No autorizado para usar el perfil ${requestedProfile === "tecnico" ? "tecnico" : "comercial"}.` }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const { id } = await params;

    if (!id) {
      return new Response(JSON.stringify({ data: null, error: "id requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: lead, error } = await sb
      .from("leads")
      .select("id,nombre,ai_report,ai_report_updated_at")
      .eq("id", id)
      .single();

    if (error) throw error;

    const leadName = (lead?.nombre && String(lead.nombre)) || `Lead ${id}`;
    const report = (lead?.ai_report && String(lead.ai_report)) || "Sin informe IA todavía.";
    const updatedAt = lead?.ai_report_updated_at ? String(lead.ai_report_updated_at) : null;
    const generatedAt = updatedAt ? new Date(updatedAt).toLocaleString() : new Date().toLocaleString();

    const parsedTabs = parseReportTabs(report);
    const tabKeyByLower = new Map(Object.keys(parsedTabs).map((k) => [k.toLowerCase(), k]));
    const sections: Array<{ name: string; content: string }> = [];
    for (const profileModuleId of reportProfile.moduleIds) {
      const key = tabKeyByLower.get(profileModuleId.toLowerCase()) ?? profileModuleId;
      const content = parsedTabs[key] ?? parsedTabs[profileModuleId];
      if (content?.trim()) {
        const label = MODULE_LABELS[profileModuleId] ?? profileModuleId;
        sections.push({ name: label, content });
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const logoUrl = `${baseUrl}/licencia.png`;

    const doc = React.createElement(LeadReportPdf, {
      title: reportProfile.title,
      subtitle: reportProfile.subtitle,
      leadName,
      generatedAt,
      sections: sections.length > 0 ? sections : [{ name: "Informe", content: report }],
      footerLeft: "Cámara Costa",
      footerRight: "Generado por EASY CRM",
      logoUrl,
    });

    const buffer = await renderToBuffer(doc);
    const body = new Uint8Array(buffer);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ data: null, error: e?.message ?? "Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
