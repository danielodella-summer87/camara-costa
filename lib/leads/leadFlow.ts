/**
 * Flujo del proceso del lead — lógica compartida entre ficha y listado.
 * Usa solo datos ya disponibles (lead, ai_report, cantidad de servicios).
 */

import {
  isOfficialCrmPersistedDocumentUrl,
  isOfficialPresentationDocumentUrl,
  isTransientGammaExportPdfUrl,
} from "@/lib/leads/gammaDocumentPolicy";
import { isCommercialStrategyApproved } from "@/lib/crm/commercialStrategyFlow";

export type LeadFlowStep = {
  id:
    | "lead"
    | "datos"
    | "investigacion"
    | "diagnostico"
    | "acciones"
    | "servicios"
    | "propuesta"
    | "presentacion";
  label: string;
  status: "done" | "current" | "pending";
  description: string;
};

export const LEAD_FLOW_STEP_IDS: LeadFlowStep["id"][] = [
  "lead",
  "datos",
  "investigacion",
  "diagnostico",
  "acciones",
  "servicios",
  "propuesta",
  "presentacion",
];

export const LEAD_FLOW_LABELS: Record<LeadFlowStep["id"], string> = {
  lead: "Lead creado",
  datos: "Datos completos",
  investigacion: "Investigación iniciada",
  diagnostico: "Diagnóstico IA",
  acciones: "Acciones definidas",
  servicios: "Servicios propuestos",
  propuesta: "Propuesta preparada",
  presentacion: "Presentación lista",
};

export const LEAD_FLOW_DESCRIPTIONS: Record<LeadFlowStep["id"], string> = {
  lead: "El lead ya fue dado de alta dentro del CRM.",
  datos: "Se cuenta con la información mínima necesaria para avanzar con el análisis.",
  investigacion: "Ya existe una base de investigación digital o relevamiento inicial del lead.",
  diagnostico: "El sistema ya generó un diagnóstico con oportunidades, visión o análisis estratégico.",
  acciones: "Ya fueron detectadas acciones concretas para ejecutar en 72 horas o 30–90 días.",
  servicios: "Ya existe una propuesta inicial de servicios EASY asociada al lead.",
  propuesta: "La propuesta comercial ya tiene estructura consultiva y base de presentación.",
  presentacion: "Ya existe una salida lista para compartir, presentar o exportar.",
};

/** Lead mínimo para calcular el flujo (ficha o listado). */
export type LeadFlowLead = {
  id?: string | null;
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  website?: string | null;
  objetivos?: string | null;
  audiencia?: string | null;
  linkedin_empresa?: string | null;
  ai_report?: string | null;
  empresas?: { instagram?: string | null; facebook?: string | null } | null;
  /** Draft de propuesta (matriz servicio × mes). Si existe y tiene rows, servicios puede considerarse hecho. */
  proposal_draft_json?: string | null;
  /** Si está definido, la propuesta comercial está confirmada → propuesta = done. */
  proposal_confirmed_at?: string | null;
  proposal_reviewed?: boolean | null;
  proposal_doc_url?: string | null;
  presentation_doc_url?: string | null;
  strategy_approved_at?: string | null;
  commercial_strategy_json?: unknown;
};

function hasProposalDraftWithRows(draftJson: unknown): boolean {
  if (draftJson === null || draftJson === undefined) return false;
  const raw = typeof draftJson === "string" ? draftJson.trim() : "";
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { rows?: unknown[] };
    return Array.isArray(parsed?.rows) && parsed.rows.length > 0;
  } catch {
    return false;
  }
}

/** Señales opcionales de presentación (Gamma/PDF). Solo pdfUrl estable cuenta para “material listo”. */
export type PresentationSignals = {
  gammaUrl?: string | null;
  pdfUrl?: string | null;
};

function parseReportTabsLocal(report: string): Record<string, string> {
  const tabs: Record<string, string> = {};
  if (!report || !report.trim()) return tabs;
  const tabPattern = /###\s+TAB:\s*(\w+)\s*\n/gi;
  const matches: Array<{ tabId: string; startIndex: number }> = [];
  let match;
  while ((match = tabPattern.exec(report)) !== null) {
    matches.push({ tabId: match[1], startIndex: match.index + match[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const startIndex = matches[i].startIndex;
    const remaining = report.slice(startIndex);
    const nextTabMatch = remaining.match(/###\s+TAB:\s*\w+\s*\n/i);
    const endIndex = nextTabMatch && typeof nextTabMatch.index === "number" ? startIndex + nextTabMatch.index : report.length;
    const content = report.slice(startIndex, endIndex).trim();
    if (content) tabs[matches[i].tabId] = content;
  }
  return tabs;
}

function getServicesCount(leadServicesOrCount: { length: number } | number): number {
  return typeof leadServicesOrCount === "number" ? leadServicesOrCount : leadServicesOrCount.length;
}

export function getPresentationReadySignal(
  lead: LeadFlowLead | null,
  _leadServicesOrCount: { length: number } | number,
  signals?: PresentationSignals,
  documents?: { presentation?: string | null } | null
): boolean {
  if (!lead) return false;
  const pdfUrl = signals?.pdfUrl ?? null;
  if (typeof pdfUrl === "string" && pdfUrl.trim().length > 0) {
    if (!isTransientGammaExportPdfUrl(pdfUrl) && isOfficialPresentationDocumentUrl(pdfUrl)) return true;
  }
  const fromLead = typeof lead.presentation_doc_url === "string" ? lead.presentation_doc_url.trim() : "";
  const fromDocs = typeof documents?.presentation === "string" ? documents.presentation.trim() : "";
  const merged = fromLead || fromDocs;
  if (merged && isOfficialPresentationDocumentUrl(merged)) return true;
  // No marcar presentación “lista” por heurísticas (p. ej. servicios + informe): solo URL oficial archivada.
  return false;
}

export type LeadFlowDocumentsMerge = {
  diagnostic?: string | null;
  strategy?: string | null;
  proposal?: string | null;
  presentation?: string | null;
} | null;

export function getLeadFlowSignals(
  lead: LeadFlowLead | null,
  leadServicesOrCount: { length: number } | number,
  presentationSignals?: PresentationSignals,
  documents?: LeadFlowDocumentsMerge
): Record<LeadFlowStep["id"], boolean> {
  const count = getServicesCount(leadServicesOrCount);
  const aiReport = lead?.ai_report;
  const rawReport = typeof aiReport === "string" ? aiReport : "";
  const tabs = parseReportTabsLocal(rawReport);
  const has = (id: string) => (tabs[id]?.trim() ?? "").length > 0;
  const entity = lead?.empresas;
  const datosCount = [
    lead?.nombre?.trim(),
    lead?.telefono?.trim(),
    lead?.email?.trim(),
    lead?.website?.trim(),
    lead?.objetivos?.trim(),
    lead?.audiencia?.trim(),
    entity?.instagram?.trim() || entity?.facebook?.trim() || lead?.linkedin_empresa?.trim(),
  ].filter(Boolean).length;
  const presentationReady = getPresentationReadySignal(lead, leadServicesOrCount, presentationSignals, documents);
  const proposalConfirmedAt = (lead as LeadFlowLead & { proposal_confirmed_at?: string | null })?.proposal_confirmed_at;
  const hasProposalConfirmed = typeof proposalConfirmedAt === "string" && proposalConfirmedAt.trim().length > 0;
  const draftWithRows = hasProposalDraftWithRows((lead as LeadFlowLead & { proposal_draft_json?: string | null })?.proposal_draft_json);

  const serviciosDone = count > 0 || draftWithRows;
  const propuestaLegacyDone = hasProposalConfirmed || count >= 2 || (count > 0 && rawReport.trim().length > 0);
  const accionesBase = has("ACCIONES") || has("plan_crecimiento");

  const proposalFromLead = typeof lead?.proposal_doc_url === "string" ? lead.proposal_doc_url.trim() : "";
  const proposalFromDocs = typeof documents?.proposal === "string" ? documents.proposal.trim() : "";
  const proposalMerged = proposalFromLead || proposalFromDocs;
  const proposalOfficial =
    Boolean(proposalMerged) && isOfficialCrmPersistedDocumentUrl(proposalMerged);
  const proposalReviewed = lead?.proposal_reviewed === true;

  let propuestaDoneFinal: boolean;
  if (hasProposalConfirmed) {
    propuestaDoneFinal = true;
  } else if (proposalOfficial) {
    propuestaDoneFinal = proposalReviewed;
  } else {
    propuestaDoneFinal = propuestaLegacyDone;
  }

  const strategyApproved = isCommercialStrategyApproved(lead, documents);

  const diagnosticDocUrl = typeof documents?.diagnostic === "string" ? documents.diagnostic.trim() : "";
  const diagnosticFromDocuments =
    Boolean(diagnosticDocUrl) && isOfficialCrmPersistedDocumentUrl(diagnosticDocUrl);

  // Una vez confirmada la propuesta económica, el siguiente paso es siempre generar el material final (Gamma/PDF).
  // No volver a mostrar "Acciones definidas" ni "Servicios": forzar acciones/servicios/propuesta = done.
  const accionesDone = hasProposalConfirmed ? true : strategyApproved ? true : accionesBase;
  const serviciosDoneFinal = hasProposalConfirmed ? true : serviciosDone;

  return {
    lead: !!lead?.id,
    datos: datosCount >= 3,
    investigacion: rawReport.length > 50 || has("INVESTIGACION_DIGITAL") || has("REDES_SOCIALES"),
    // Documento diagnostic en lead_documents (p. ej. PDF Gamma o informe IA archivado como markdown) o tabs clásicos del informe.
    diagnostico: diagnosticFromDocuments || has("FODA") || has("OPORTUNIDADES"),
    acciones: accionesDone,
    servicios: serviciosDoneFinal,
    propuesta: propuestaDoneFinal,
    presentacion: presentationReady,
  };
}

export function getLeadFlowSteps(
  lead: LeadFlowLead | null,
  leadServicesOrCount: { length: number } | number,
  presentationSignals?: PresentationSignals,
  documents?: LeadFlowDocumentsMerge
): LeadFlowStep[] {
  const signals = getLeadFlowSignals(lead, leadServicesOrCount, presentationSignals, documents);
  const steps: LeadFlowStep[] = [];
  let currentAssigned = false;
  for (const stepId of LEAD_FLOW_STEP_IDS) {
    const done = signals[stepId];
    let status: "done" | "current" | "pending" = "pending";
    if (done) {
      status = "done";
    } else if (!currentAssigned) {
      status = "current";
      currentAssigned = true;
    }
    steps.push({
      id: stepId,
      label: LEAD_FLOW_LABELS[stepId],
      status,
      description: LEAD_FLOW_DESCRIPTIONS[stepId],
    });
  }
  return steps;
}

export function getCurrentFlowStep(steps: LeadFlowStep[]): LeadFlowStep | null {
  return steps.find((s) => s.status === "current") ?? null;
}

const TOTAL_FLOW_STEPS = LEAD_FLOW_STEP_IDS.length;

/** Porcentaje de avance del flujo (0–100): solo estaciones con status === "done". */
export function getLeadFlowProgressPercent(steps: LeadFlowStep[]): number {
  const doneCount = steps.filter((s) => s.status === "done").length;
  return Math.round((doneCount / TOTAL_FLOW_STEPS) * 100);
}

/** Texto corto y accionable para el siguiente paso del flujo. */
export function getLeadNextAction(step: LeadFlowStep | null): string {
  if (step === null) return "Flujo completo";
  switch (step.id) {
    case "lead":
      return "Crear lead correctamente";
    case "datos":
      return "Completar datos del lead";
    case "investigacion":
      return "Iniciar investigación";
    case "diagnostico":
      return "Generar diagnóstico IA";
    case "acciones":
      return "Definir acciones";
    case "servicios":
      return "Cargar servicios";
    case "propuesta":
      return "Preparar propuesta";
    case "presentacion":
      return "Generar presentación";
    default:
      return "Flujo completo";
  }
}
