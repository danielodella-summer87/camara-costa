/**
 * Resolución de labels de UI desde keys + personalización.
 * Las keys (ej. "socios", "socios.singular", "socios.plural") se mapean al texto configurado en Personalización.
 */

export type PersonalizacionLabels = {
  clienteSingular?: string | null;
  clientePlural?: string | null;
};

/**
 * Resuelve el label de UI para una key del menú/NAV o entidad.
 * - key "socios" → p.clientePlural si existe, si no "Socios"
 * - key "socios.plural" → p.clientePlural || "Socios"
 * - key "socios.singular" → p.clienteSingular || "Socio"
 * - Otras keys se devuelven tal cual (texto directo del NAV).
 */
export function resolveUILabel(
  key: string,
  p: PersonalizacionLabels | null | undefined
): string {
  if (key === "socios" || key === "socios.plural") {
    const plural = p?.clientePlural?.trim();
    return plural && plural.length > 0 ? plural : "Socios";
  }
  if (key === "socios.singular") {
    const singular = p?.clienteSingular?.trim();
    return singular && singular.length > 0 ? singular : "Socio";
  }
  return key;
}

/**
 * Resuelve el nombre de la entidad (singular o plural) desde personalización.
 * - plural: p.clientePlural || "Socios"
 * - singular: p.clienteSingular || "Socio"
 */
export function resolveEntityName(
  scope: "singular" | "plural",
  p: PersonalizacionLabels | null | undefined
): string {
  if (scope === "plural") {
    const plural = p?.clientePlural?.trim();
    return plural && plural.length > 0 ? plural : "Socios";
  }
  const singular = p?.clienteSingular?.trim();
  return singular && singular.length > 0 ? singular : "Socio";
}
