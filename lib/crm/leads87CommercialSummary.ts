/**
 * Buckets de resumen comercial LEADS87 (listado / dashboard).
 * Fuente de verdad: `getLeadStage` → misma macro que el detalle y el % de avance.
 */

import { getLeadStage, type DerivedLeadStage } from "./getLeadDerivedFlow";
import type { LeadForLeadsOkMacro, LeadsOkDocuments } from "./leadsOkMacroFlow";

export type Leads87CommercialSummaryBucket = "nuevas" | "activas" | "en_propuesta" | "en_seguimiento";

/**
 * - nuevas: etapa derivada `lead` (macro 1 activa — datos base / aún no avanzó el flujo).
 * - activas: investigación → servicios (macros 2–5).
 * - en_propuesta: propuesta y presentación (macros 6–7).
 * - en_seguimiento: cierre y proceso completo (macro 8 o todas completas).
 */
export function commercialSummaryBucketForDerivedStage(stage: DerivedLeadStage): Leads87CommercialSummaryBucket {
  switch (stage) {
    case "lead":
      return "nuevas";
    case "investigacion":
    case "diagnostico":
    case "estrategia":
    case "servicios":
      return "activas";
    case "propuesta":
    case "presentacion":
      return "en_propuesta";
    case "cierre":
    case "completo":
      return "en_seguimiento";
    default:
      return "nuevas";
  }
}

export type Leads87CommercialSummaryInput = {
  lead: LeadForLeadsOkMacro;
  documents?: LeadsOkDocuments | null;
};

export function countLeads87CommercialSummary(items: Leads87CommercialSummaryInput[]): {
  nuevas: number;
  activas: number;
  en_propuesta: number;
  en_seguimiento: number;
  total: number;
} {
  const out = {
    nuevas: 0,
    activas: 0,
    en_propuesta: 0,
    en_seguimiento: 0,
    total: items.length,
  };
  for (const { lead, documents } of items) {
    const stage = getLeadStage(lead, documents ?? null);
    const b = commercialSummaryBucketForDerivedStage(stage);
    out[b]++;
  }
  return out;
}
