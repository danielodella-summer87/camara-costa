/**
 * KPIs del dashboard comercial alineados con el flujo LEADS87 (getLeadsOkMacroFlow vía getLeadMacroFlowDisplay).
 * No reinterpretar el estado con reglas paralelas de pipeline.
 */

import { isLeadActive } from "@/lib/leads/leadStatusPolicy";
import { getLeadMacroFlowDisplay } from "./getLeadDerivedFlow";
import type { LeadForLeadsOkMacro, LeadsOkDocuments } from "./leadsOkMacroFlow";

/** Filas del GET /api/admin/leads con los campos necesarios para el macro LEADS87 (mismo criterio que el listado LEADS87). */
export type ApiLeadRowForMacro = {
  id?: string | null;
  nombre?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  website?: string | null;
  objetivos?: string | null;
  audiencia?: string | null;
  tamano?: string | null;
  notas?: string | null;
  pipeline?: string | null;
  proposal_confirmed_at?: string | null;
  proposal_sent_at?: string | null;
  proposal_doc_url?: string | null;
  presentation_doc_url?: string | null;
  proposal_reviewed?: boolean | null;
  commercial_stage?: string | null;
  commercial_strategy_json?: unknown;
  strategy_approved_at?: string | null;
  ai_report?: string | null;
  empresas?: { nombre?: string | null } | null;
  initiative_kind?: string | null;
  project_description?: string | null;
};

export function toMacroLeadFromApiRow(l: ApiLeadRowForMacro): LeadForLeadsOkMacro {
  return {
    id: l.id,
    nombre: l.nombre,
    contacto: l.contacto,
    telefono: l.telefono,
    email: l.email,
    website: l.website ?? null,
    objetivos: l.objetivos,
    audiencia: l.audiencia,
    tamano: l.tamano ?? null,
    notas: l.notas,
    pipeline: l.pipeline,
    proposal_confirmed_at: l.proposal_confirmed_at,
    proposal_sent_at: l.proposal_sent_at,
    proposal_doc_url: l.proposal_doc_url,
    presentation_doc_url: l.presentation_doc_url,
    proposal_reviewed: l.proposal_reviewed,
    commercial_stage: l.commercial_stage,
    commercial_strategy_json: l.commercial_strategy_json,
    strategy_approved_at: l.strategy_approved_at,
    ai_report: l.ai_report,
    empresas: l.empresas,
    initiative_kind: l.initiative_kind ?? null,
    project_description: l.project_description ?? null,
  };
}

export type DashboardCommercialBucket = "nueva" | "activa" | "en_propuesta" | "en_seguimiento" | "cerrada";

/**
 * Categoría resumida para tarjetas del dashboard.
 * - cerrada: pipeline CRM cerrado o flujo LEADS87 completo (100%).
 */
export function getDashboardCommercialBucket(
  lead: LeadForLeadsOkMacro | null,
  documents: LeadsOkDocuments | null,
  pipeline: string | null
): DashboardCommercialBucket {
  if (!isLeadActive(pipeline)) return "cerrada";
  const snap = getLeadMacroFlowDisplay(lead, documents);
  if (snap.isFlowCompleted) return "cerrada";
  switch (snap.stage) {
    case "lead":
    case "investigacion":
      return "nueva";
    case "diagnostico":
    case "estrategia":
    case "servicios":
      return "activa";
    case "propuesta":
    case "presentacion":
      return "en_propuesta";
    case "cierre":
      return "en_seguimiento";
    case "completo":
      return "cerrada";
    default:
      return "activa";
  }
}

export type CommercialFlowKpiSummary = {
  nueva: number;
  activa: number;
  en_propuesta: number;
  en_seguimiento: number;
  cerrada: number;
  total: number;
  /** Promedio de % avance LEADS87 solo entre leads con pipeline activo (post-cierre no reduce el avance del lead completado). */
  avgProgressActive: number;
};

export type DashboardFlowRowInput = {
  macroLead: LeadForLeadsOkMacro | null;
  documents: LeadsOkDocuments | null;
  pipeline: string | null;
};

export function summarizeCommercialFlowKpis(rows: DashboardFlowRowInput[]): CommercialFlowKpiSummary {
  const counts: Record<DashboardCommercialBucket, number> = {
    nueva: 0,
    activa: 0,
    en_propuesta: 0,
    en_seguimiento: 0,
    cerrada: 0,
  };
  let sumActive = 0;
  let nActive = 0;

  for (const r of rows) {
    const snap = getLeadMacroFlowDisplay(r.macroLead, r.documents);
    if (isLeadActive(r.pipeline)) {
      sumActive += snap.progress;
      nActive += 1;
    }
    const b = getDashboardCommercialBucket(r.macroLead, r.documents, r.pipeline);
    counts[b] += 1;
  }

  return {
    nueva: counts.nueva,
    activa: counts.activa,
    en_propuesta: counts.en_propuesta,
    en_seguimiento: counts.en_seguimiento,
    cerrada: counts.cerrada,
    total: rows.length,
    avgProgressActive: nActive > 0 ? Math.round(sumActive / nActive) : 0,
  };
}
