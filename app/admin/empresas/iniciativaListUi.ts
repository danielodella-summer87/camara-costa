/**
 * UI del listado de Iniciativas: buckets de decisión y filtros (solo presentación).
 * La prioridad comercial asistida vive en `lib/ai/initiativeAssessment.ts`.
 */

export type DecisionBucket = "nuevo" | "revisado" | "convertido" | "descartado";

/** Agrupa `estado_revision` del backend en 4 estados visuales para decisión comercial. */
export function decisionBucketFromEstado(estado_revision: string | null | undefined): DecisionBucket {
  const k = (estado_revision ?? "").trim().toLowerCase();
  if (k === "convertida_a_lead") return "convertido";
  if (k === "descartada") return "descartado";
  if (k === "en_revision" || k === "validada") return "revisado";
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
  filtro: FiltroIniciativaBucket
): boolean {
  if (!filtro) return true;
  const k = (estado_revision ?? "").trim().toLowerCase();
  switch (filtro) {
    case "nuevos":
      return k === "nueva" || k === "importada" || k === "";
    case "revisados":
      return k === "en_revision" || k === "validada";
    case "convertidos":
      return k === "convertida_a_lead";
    case "descartados":
      return k === "descartada";
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
