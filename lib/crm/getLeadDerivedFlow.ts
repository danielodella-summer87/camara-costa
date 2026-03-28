/**
 * Etapa y % de avance derivados del mismo criterio que el detalle LEADS87 (macro flow).
 * No usar pipeline plano ni heurísticas ajenas a getLeadsOkMacroFlow.
 */

import {
  getLeadsOkMacroFlow,
  type LeadForLeadsOkMacro,
  type LeadsOkDocuments,
} from "./leadsOkMacroFlow";

export type DerivedLeadStage =
  | "lead"
  | "investigacion"
  | "diagnostico"
  | "estrategia"
  | "servicios"
  | "propuesta"
  | "presentacion"
  | "cierre"
  | "completo";

const MACRO_ID_TO_STAGE: Record<number, DerivedLeadStage> = {
  1: "lead",
  2: "investigacion",
  3: "diagnostico",
  4: "estrategia",
  5: "servicios",
  6: "propuesta",
  7: "presentacion",
  8: "cierre",
};

/** Etiqueta corta alineada con el stepper / expectativa de lista. */
export const DERIVED_LEAD_STAGE_LABEL_ES: Record<DerivedLeadStage, string> = {
  lead: "Lead",
  investigacion: "Investigación",
  diagnostico: "Diagnóstico",
  estrategia: "Estrategia",
  servicios: "Servicios",
  propuesta: "Propuesta",
  presentacion: "Presentación",
  cierre: "Cierre",
  completo: "Proceso completo",
};

/** % de avance por etapa derivada (coherente con “Investigación → 25%”, etc.). */
export const DERIVED_LEAD_STAGE_PROGRESS: Record<DerivedLeadStage, number> = {
  lead: 0,
  investigacion: 25,
  diagnostico: 38,
  estrategia: 50,
  servicios: 63,
  propuesta: 75,
  presentacion: 88,
  cierre: 100,
  completo: 100,
};

/**
 * Une URLs de documentos desde `lead_documents` y columnas espejo en `leads`
 * (misma idea que `documentsForUnifiedFlow` en detalle).
 */
export function mergeDocumentsForFlow(
  lead: LeadForLeadsOkMacro | null,
  documents?: LeadsOkDocuments | null
): LeadsOkDocuments | null {
  if (!lead && !documents) return null;
  const d = { ...(documents ?? {}) } as LeadsOkDocuments;
  const p = typeof lead?.proposal_doc_url === "string" ? lead.proposal_doc_url.trim() : "";
  const pr = typeof lead?.presentation_doc_url === "string" ? lead.presentation_doc_url.trim() : "";
  if (p) d.proposal = p;
  if (pr) d.presentation = pr;
  return d;
}

/**
 * Snapshot único para listado y widgets: misma macro que el detalle LEADS87, sin recalcular heurísticas aparte.
 * Si todas las etapas macro están `completed` → 100% y etapa `completo` (post-cierre no baja el %).
 */
export function getLeadMacroFlowDisplay(
  lead: LeadForLeadsOkMacro | null,
  documents?: LeadsOkDocuments | null
): {
  stage: DerivedLeadStage;
  progress: number;
  label: string;
  isFlowCompleted: boolean;
} {
  if (!lead) {
    return {
      stage: "lead",
      progress: DERIVED_LEAD_STAGE_PROGRESS.lead,
      label: DERIVED_LEAD_STAGE_LABEL_ES.lead,
      isFlowCompleted: false,
    };
  }
  const merged = mergeDocumentsForFlow(lead, documents ?? null);
  const macro = getLeadsOkMacroFlow(lead, merged);
  const isFlowCompleted = macro.length > 0 && macro.every((s) => s.status === "completed");

  let stage: DerivedLeadStage;
  if (isFlowCompleted) {
    stage = "completo";
  } else {
    const activeIdx = macro.findIndex((s) => s.status === "active");
    if (activeIdx < 0) {
      stage = "lead";
    } else {
      const id = macro[activeIdx]?.id ?? 1;
      stage = MACRO_ID_TO_STAGE[id] ?? "lead";
    }
  }

  const progress = isFlowCompleted ? 100 : getLeadProgress(stage);
  const label = isFlowCompleted ? DERIVED_LEAD_STAGE_LABEL_ES.completo : getLeadStageShortLabel(stage);

  return { stage, progress, label, isFlowCompleted };
}

/**
 * Etapa comercial derivada (primera macro “active” según getLeadsOkMacroFlow).
 * `commercial_stage === 'closing'` (o alias `stage`) ya se interpreta vía la macro (etapa 7–8).
 */
export function getLeadStage(
  lead: LeadForLeadsOkMacro | null,
  documents?: LeadsOkDocuments | null
): DerivedLeadStage {
  return getLeadMacroFlowDisplay(lead, documents).stage;
}

export function getLeadProgress(stage: DerivedLeadStage): number {
  return DERIVED_LEAD_STAGE_PROGRESS[stage] ?? 0;
}

export function getLeadStageShortLabel(stage: DerivedLeadStage): string {
  return DERIVED_LEAD_STAGE_LABEL_ES[stage] ?? "Lead";
}
