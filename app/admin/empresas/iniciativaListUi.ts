/**
 * UI del listado de Iniciativas: buckets de decisión y filtros (solo presentación).
 * La prioridad comercial asistida vive en `lib/ai/initiativeAssessment.ts`.
 */

import { normalizeEstadoRevisionLectura } from "@/lib/crm/iniciativaEstadoRevision";

export type DecisionBucket = "nuevo" | "revisado" | "convertido" | "descartado";

/** Agrupa `estado_revision` del backend en 4 estados visuales para decisión comercial. */
export function decisionBucketFromEstado(
  estado_revision: string | null | undefined,
  converted_lead_id?: string | null
): DecisionBucket {
  const raw = (estado_revision ?? "").trim().toLowerCase();
  if (converted_lead_id?.trim() || raw === "convertida_a_lead") {
    return "convertido";
  }
  const k = normalizeEstadoRevisionLectura(estado_revision);
  if (k === "descartado") return "descartado";
  if (k === "revisado") return "revisado";
  return "nuevo";
}

export function labelDecisionBucket(bucket: DecisionBucket): string {
  const m: Record<DecisionBucket, string> = {
    nuevo: "Nuevo",
    revisado: "Revisado",
    convertido: "Convertido",
    descartado: "Descartado",
  };
  return m[bucket];
}

export function badgeClassDecisionBucket(bucket: DecisionBucket): string {
  switch (bucket) {
    case "nuevo":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "revisado":
      return "bg-blue-50 text-blue-900 border-blue-200";
    case "convertido":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "descartado":
      return "bg-red-50 text-red-900 border-red-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export type FiltroIniciativaBucket = "" | "nuevos" | "revisados" | "convertidos" | "descartados";

export function matchesFiltroBucket(
  estado_revision: string | null | undefined,
  filtro: FiltroIniciativaBucket,
  converted_lead_id?: string | null
): boolean {
  if (!filtro) return true;
  const raw = (estado_revision ?? "").trim().toLowerCase();
  const tieneLead = Boolean(converted_lead_id?.trim()) || raw === "convertida_a_lead";
  const k = normalizeEstadoRevisionLectura(estado_revision);
  switch (filtro) {
    case "nuevos":
      return k === "nuevo" && !tieneLead;
    case "revisados":
      return k === "revisado" && !tieneLead;
    case "convertidos":
      return tieneLead;
    case "descartados":
      return k === "descartado";
    default:
      return true;
  }
}

/** Conteo de convertidas: estado o lead vinculado. */
export function esConvertidaVisualmente(
  estado_revision: string | null | undefined,
  converted_lead_id: string | null | undefined
): boolean {
  const k = (estado_revision ?? "").trim().toLowerCase();
  if (k === "convertida_a_lead") return true;
  return Boolean(converted_lead_id?.trim());
}
