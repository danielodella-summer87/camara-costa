/**
 * Labels personalizables del sistema
 * 
 * Helper central para leer labels con fallback a defaults.
 * Los labels se guardan en public.config con key "portal_config"
 * y campos: label_member_singular, label_member_plural
 */

export const DEFAULT_LABELS = {
  memberSingular: "Socio",
  memberPlural: "Socios",
} as const;

export type Labels = {
  memberSingular: string;
  memberPlural: string;
};

/**
 * Obtiene los labels desde la configuración con fallback a defaults
 * 
 * @param config - Objeto de configuración del portal (puede venir de /api/admin/config/portal)
 * @returns Labels con valores personalizados o defaults
 */
export function getLabels(config?: Record<string, any>): Labels {
  if (!config) {
    return DEFAULT_LABELS;
  }

  const singular = config.label_member_singular;
  const plural = config.label_member_plural;

  return {
    memberSingular:
      typeof singular === "string" && singular.trim()
        ? singular.trim()
        : DEFAULT_LABELS.memberSingular,
    memberPlural:
      typeof plural === "string" && plural.trim()
        ? plural.trim()
        : DEFAULT_LABELS.memberPlural,
  };
}

/**
 * Hook helper para usar en componentes client-side
 * Hace fetch de la configuración y devuelve los labels
 */
export async function fetchLabels(): Promise<Labels> {
  try {
    const res = await fetch("/api/admin/config/portal", {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });
    const json = await res.json();
    return getLabels(json?.data);
  } catch {
    return DEFAULT_LABELS;
  }
}
