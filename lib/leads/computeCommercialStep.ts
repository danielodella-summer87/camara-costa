/**
 * Estado lineal del proceso comercial (5 pasos).
 * Una sola fuente de verdad para barra, siguiente paso y botones.
 *
 * Orden: 1 Análisis → 2 Diagnóstico → 3 Estrategia → 4 Estructura → 5 Propuesta final para cliente.
 */

export type CommercialStep = 1 | 2 | 3 | 4 | 5;

export type ComputeCommercialStepParams = {
  /** Lead con ai_report y proposal_confirmed_at */
  lead: { ai_report?: string | null; proposal_confirmed_at?: string | null } | null;
  /** URLs de documentos generados (desde API o estado local) */
  documents: { diagnostic?: string | null; strategy?: string | null; proposal?: string | null } | null;
  /** Estructura de servicios/costos definida (tab Consultor o propuesta confirmada) */
  structureReady: boolean;
};

/**
 * Calcula el paso actual del proceso comercial de forma lineal.
 * Si falta un paso anterior, no se considera completado ningún paso posterior.
 */
export function computeCurrentStep(params: ComputeCommercialStepParams): CommercialStep {
  const { lead, documents, structureReady } = params;
  const analysis = Boolean(lead?.ai_report && String(lead.ai_report).trim().length > 0);
  const diagnostico = Boolean(documents?.diagnostic && String(documents.diagnostic).trim().length > 0);
  const estrategia = Boolean(documents?.strategy && String(documents.strategy).trim().length > 0);
  const propuesta = Boolean(documents?.proposal && String(documents.proposal).trim().length > 0);

  if (!analysis) return 1;
  if (!diagnostico) return 2;
  if (!estrategia) return 3;
  if (!structureReady) return 4;
  if (!propuesta) return 5;
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
