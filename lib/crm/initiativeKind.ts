/** Valores persistidos en empresas.initiative_kind y leads.initiative_kind */

export const INITIATIVE_KIND_STANDARD = "standard";
export const INITIATIVE_KIND_STARTUP = "startup";

/** Longitud mínima de project_description para modo startup (creación / macro LEADS87). */
export const MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH = 30;

export function isStartupInitiativeKind(v: string | null | undefined): boolean {
  return String(v ?? "").trim().toLowerCase() === INITIATIVE_KIND_STARTUP;
}

export function normalizeInitiativeKind(v: unknown): typeof INITIATIVE_KIND_STANDARD | typeof INITIATIVE_KIND_STARTUP {
  const s = String(v ?? "").trim().toLowerCase();
  return s === INITIATIVE_KIND_STARTUP ? INITIATIVE_KIND_STARTUP : INITIATIVE_KIND_STANDARD;
}
