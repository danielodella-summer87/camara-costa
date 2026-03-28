/**
 * Estrategia comercial LEADS87 (borrador / confirmada).
 * Persistido en `leads.commercial_strategy_json` + `leads.strategy_approved_at`.
 */

export const COMMERCIAL_STRATEGY_FIELD_KEYS = [
  "objetivo_principal",
  "estrategia_dominante",
  "canales_prioritarios",
  "quick_wins",
  "estrategia_mediano_plazo",
  "justificacion",
] as const;

export type CommercialStrategyFieldKey = (typeof COMMERCIAL_STRATEGY_FIELD_KEYS)[number];

export type CommercialStrategyUserInputs = {
  prioridad_negocio?: string;
  urgencia?: string;
  presupuesto?: string;
  restricciones?: string;
};

export type CommercialStrategyStored = {
  generated: Partial<Record<CommercialStrategyFieldKey, string>>;
  edited: Partial<Record<CommercialStrategyFieldKey, string>>;
  userInputs: CommercialStrategyUserInputs;
};

export const COMMERCIAL_STRATEGY_LABELS: Record<CommercialStrategyFieldKey, string> = {
  objetivo_principal: "Objetivo principal",
  estrategia_dominante: "Estrategia dominante",
  canales_prioritarios: "Canales prioritarios",
  quick_wins: "Quick wins",
  estrategia_mediano_plazo: "Estrategia mediano plazo",
  justificacion: "Justificación",
};

export function emptyCommercialStrategyStored(): CommercialStrategyStored {
  return {
    generated: {},
    edited: {},
    userInputs: {},
  };
}
