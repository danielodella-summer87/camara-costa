/**
 * Fuente única de verdad: lead “cerrado” vs “activo” según el nombre del pipeline en `leads.pipeline`.
 *
 * No depende de tablas nuevas: solo nombres normalizados (minúsculas, sin acentos).
 * Para ampliar cierres (Descartado, Cancelado, etc.): agregar la forma normalizada a
 * `CLOSED_LEAD_PIPELINES_NORMALIZED` y no tocar el resto del código.
 */

/** Normalización estable para comparar nombres de pipeline (acentos, mayúsculas). */
export function normalizePipelineForPolicy(pipeline: string | null | undefined): string {
  return (pipeline ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Pipelines que cierran el lead (sin seguimiento comercial activo).
 *
 * - Mínimo de negocio: ganado / perdido (tipos `ganado` | `perdido` en `leads_pipelines`).
 * - Alineado con listados y métricas que ya excluían también:
 *   cerrado, no interesado.
 *
 * Próximos candidatos (descomentar o agregar cuando existan en datos reales):
 * - "descartado"
 * - "cancelado"
 */
export const CLOSED_LEAD_PIPELINES_NORMALIZED = [
  "ganado",
  "perdido",
  "cerrado",
  "no interesado",
  // "descartado",
  // "cancelado",
] as const;

const CLOSED_SET = new Set<string>(CLOSED_LEAD_PIPELINES_NORMALIZED);

export function isLeadClosed(pipeline: string | null | undefined): boolean {
  return CLOSED_SET.has(normalizePipelineForPolicy(pipeline));
}

export function isLeadActive(pipeline: string | null | undefined): boolean {
  return !isLeadClosed(pipeline);
}

/** Negocio ganado (p. ej. crear socio al pasar a esta etapa). */
export function isLeadWon(pipeline: string | null | undefined): boolean {
  return normalizePipelineForPolicy(pipeline) === "ganado";
}

export function isLeadClosedFromRow(lead: { pipeline?: string | null } | null | undefined): boolean {
  if (!lead) return false;
  return isLeadClosed(lead.pipeline);
}
