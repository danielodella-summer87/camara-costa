/** Estados de ciclo de vida (tabla `empresas`, producto Iniciativa). CHECK en DB: solo estos tres al persistir. */

export const EMPRESAS_ESTADO_REVISION_VALIDOS = ["nuevo", "revisado", "descartado"] as const;

export type EstadoRevisionIniciativa = (typeof EMPRESAS_ESTADO_REVISION_VALIDOS)[number];

/** Tras convertir a lead: mismo valor que “procesada”, coherente con el constraint. */
export const ESTADO_REVISION_TRAS_CONVERTIR_A_LEAD: EstadoRevisionIniciativa = "revisado";

const VALID_ESC = new Set<string>(EMPRESAS_ESTADO_REVISION_VALIDOS);

export function esEstadoRevisionValidoParaEscritura(s: string | null | undefined): s is EstadoRevisionIniciativa {
  const k = (s ?? "").trim().toLowerCase();
  return VALID_ESC.has(k);
}

/**
 * Normalización única lectura → valor canónico persistible.
 * - Valores ya válidos: sin cambio
 * - descartada → descartado
 * - convertida | convertida_a_lead → revisado
 * - importada | nueva → nuevo
 * - en_revision | validada → revisado
 * - vacío / null / desconocido → nuevo
 */
export function normalizeEstadoRevisionLectura(codigo: string | null | undefined): EstadoRevisionIniciativa {
  const k = (codigo ?? "").trim().toLowerCase();
  if (!k) return "nuevo";
  if (VALID_ESC.has(k)) return k as EstadoRevisionIniciativa;
  if (k === "descartada") return "descartado";
  if (k === "convertida" || k === "convertida_a_lead") return "revisado";
  if (k === "importada" || k === "nueva") return "nuevo";
  if (k === "en_revision" || k === "validada") return "revisado";
  return "nuevo";
}

/** Alias: mismo criterio que {@link normalizeEstadoRevisionLectura} (formularios / PATCH). */
export function coerceEstadoRevisionParaEscritura(codigo: string | null | undefined): EstadoRevisionIniciativa {
  return normalizeEstadoRevisionLectura(codigo);
}

/** Etiqueta de badge: si hay lead vinculado, “Convertida a lead”; si no, etiqueta del estado ya normalizado. */
export function labelEstadoRevisionIniciativaVisible(
  estado_revision: string | null | undefined,
  converted_lead_id?: string | null
): string {
  if (converted_lead_id?.trim()) return "Convertida a lead";
  return labelEstadoRevisionIniciativa(normalizeEstadoRevisionLectura(estado_revision));
}

export function badgeClassEstadoRevisionVisible(
  estado_revision: string | null | undefined,
  converted_lead_id?: string | null
): string {
  if (converted_lead_id?.trim()) return "bg-emerald-100 text-emerald-900 border-emerald-200";
  return badgeClassEstadoRevision(normalizeEstadoRevisionLectura(estado_revision));
}

export function labelEstadoRevisionIniciativa(codigo: string | null | undefined): string {
  const k = (codigo ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    nuevo: "Nuevo",
    revisado: "Revisado",
    descartado: "Descartado",
    nueva: "Nueva",
    importada: "Importada",
    en_revision: "En revisión",
    validada: "Validada",
    descartada: "Descartada",
    convertida: "Revisado",
    convertida_a_lead: "Convertida a lead",
  };
  return map[k] ?? (k ? k : "—");
}

export function badgeClassEstadoRevision(codigo: string | null | undefined): string {
  const k = (codigo ?? "").trim().toLowerCase();
  if (k === "convertida_a_lead" || k === "convertida") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (k === "revisado") return "bg-blue-50 text-blue-900 border-blue-200";
  if (k === "nuevo") return "bg-violet-50 text-violet-900 border-violet-200";
  if (k === "descartado") return "bg-slate-200 text-slate-700 border-slate-300";
  if (k === "validada") return "bg-blue-50 text-blue-900 border-blue-200";
  if (k === "descartada") return "bg-slate-200 text-slate-700 border-slate-300";
  if (k === "importada") return "bg-amber-50 text-amber-900 border-amber-200";
  if (k === "nueva") return "bg-violet-50 text-violet-900 border-violet-200";
  if (k === "en_revision") return "bg-sky-50 text-sky-900 border-sky-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}
