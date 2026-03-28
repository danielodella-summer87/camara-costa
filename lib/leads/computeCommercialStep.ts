/**
 * Estado lineal del proceso comercial (6 pasos).
 * Fuente compartida con getCommercialNextAction y la ficha /admin/leads/[id].
 *
 * Orden: 1 Análisis → 2 Diagnóstico → 3 Estrategia → 4 Estructura → 5 Propuesta → 6 Presentación / cierre.
 */

import { isCommercialStrategyApproved } from "@/lib/crm/commercialStrategyFlow";
import { getCommercialStepState } from "@/lib/crm/getCommercialStepState";

export type CommercialStep = 1 | 2 | 3 | 4 | 5 | 6;

export type ComputeCommercialStepParams = {
  lead: {
    ai_report?: string | null;
    proposal_confirmed_at?: string | null;
    proposal_reviewed?: boolean | null;
    proposal_doc_url?: string | null;
    presentation_doc_url?: string | null;
    commercial_stage?: string | null;
    stage?: string | null;
    strategy_approved_at?: string | null;
    commercial_strategy_json?: unknown;
  } | null;
  documents: {
    diagnostic?: string | null;
    strategy?: string | null;
    proposal?: string | null;
    presentation?: string | null;
  } | null;
  structureReady: boolean;
};

/**
 * Calcula el paso actual del proceso comercial de forma lineal.
 * La estrategia puede estar cerrada por LEADS87 (strategy_approved_at / JSON) sin URL legacy en `documents.strategy`.
 * El paso 6 agrupa presentación pendiente, presentación lista y cierre según getCommercialStepState.
 */
export function computeCurrentStep(params: ComputeCommercialStepParams): CommercialStep {
  const { lead, documents, structureReady } = params;
  const analysis = Boolean(lead?.ai_report && String(lead.ai_report).trim().length > 0);
  const diagnostico = Boolean(documents?.diagnostic && String(documents.diagnostic).trim().length > 0);
  const strategyClosed = isCommercialStrategyApproved(lead, documents);
  const estrategia = strategyClosed || Boolean(documents?.strategy && String(documents.strategy).trim().length > 0);

  if (!analysis) return 1;
  if (!diagnostico) return 2;
  if (!estrategia) return 3;
  if (!structureReady) return 4;

  const pipeline = getCommercialStepState(lead, documents);
  if (pipeline === "closing") return 6;
  if (pipeline === "presentation_ready") return 6;
  if (pipeline === "ready_for_presentation") return 6;
  return 5;
}

/** Paso N está completado solo si el paso actual es mayor que N. */
export function isStepDone(stepNumber: CommercialStep, currentStep: CommercialStep): boolean {
  return currentStep > stepNumber;
}

/** Paso N es el actual. */
export function isStepActual(stepNumber: CommercialStep, currentStep: CommercialStep): boolean {
  return currentStep === stepNumber;
}
