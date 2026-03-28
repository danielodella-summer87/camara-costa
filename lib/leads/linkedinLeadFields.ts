/**
 * Convención única para LinkedIn en `public.leads` (API y selects):
 * - linkedin_empresa
 * - linkedin_personal
 *
 * `linkedin_director` solo se usa en lectura legacy si la columna `linkedin_personal` no existe aún.
 */

export const LEADS_LINKEDIN_SELECT_PERSONAL = "linkedin_empresa,linkedin_personal";
export const LEADS_LINKEDIN_SELECT_LEGACY_DIRECTOR = "linkedin_empresa,linkedin_director";

export function isMissingLeadsLinkedinPersonalColumn(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase();
  return msg.includes("could not find the 'linkedin_personal' column of 'leads'");
}

/** Sustituye el fragmento canónico por el legacy (o viceversa) en un string .select() */
export function leadsSelectWithLinkedinVariant(select: string, variant: "personal" | "director"): string {
  if (variant === "personal") {
    return select.replace(LEADS_LINKEDIN_SELECT_LEGACY_DIRECTOR, LEADS_LINKEDIN_SELECT_PERSONAL);
  }
  return select.replace(LEADS_LINKEDIN_SELECT_PERSONAL, LEADS_LINKEDIN_SELECT_LEGACY_DIRECTOR);
}

/** Respuesta API: un solo contacto LinkedIn; no exponer linkedin_director mezclado. */
export function shapeLeadRowLinkedinForApi(row: Record<string, unknown>): Record<string, unknown> {
  const empRaw = row.linkedin_empresa;
  const perRaw = row.linkedin_personal;
  const dirRaw = row.linkedin_director;
  const emp = typeof empRaw === "string" ? empRaw.trim() : "";
  const per = typeof perRaw === "string" ? perRaw.trim() : "";
  const dir = typeof dirRaw === "string" ? dirRaw.trim() : "";
  const personal = per || dir || null;
  const { linkedin_director: _d, ...rest } = row;
  return {
    ...rest,
    linkedin_empresa: emp || null,
    linkedin_personal: personal,
  };
}
