/**
 * Helpers para prompts personalizados por módulo del lead.
 * ai_custom_prompt en DB es TEXT: guardamos JSON serializado { "TAB_ID": "prompt", ... }.
 * Compatibilidad: si el valor es string plano (legacy), se expone como legacyText.
 */

export type ParsedLeadCustomPrompt = {
  byModule: Record<string, string>;
  legacyText: string | null;
};

/**
 * Parsea el valor crudo de lead.ai_custom_prompt.
 * - Si raw es un objeto válido (o string JSON parseable a objeto) → byModule con las claves.
 * - Si raw es string no-JSON (texto plano legacy) → legacyText = raw, byModule vacío.
 * - Si está vacío/null → byModule vacío, legacyText null.
 */
export function parseLeadCustomPrompt(raw: unknown): ParsedLeadCustomPrompt {
  const empty = { byModule: {}, legacyText: null };
  if (raw === null || raw === undefined) return empty;

  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const byModule: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof k === "string" && typeof v === "string" && v.trim()) {
        byModule[k.trim()] = v.trim();
      }
    }
    return { byModule, legacyText: null };
  }

  if (typeof raw !== "string") return empty;
  const trimmed = raw.trim();
  if (!trimmed) return empty;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const byModule: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k === "string" && typeof v === "string" && (v as string).trim()) {
          byModule[k.trim()] = (v as string).trim();
        }
      }
      return { byModule, legacyText: null };
    }
  } catch {
    // No es JSON válido → texto plano legacy
  }

  return { byModule: {}, legacyText: trimmed };
}

/**
 * Serializa byModule a string para guardar en leads.ai_custom_prompt (TEXT).
 * Si byModule está vacío, devuelve null.
 */
export function serializeLeadCustomPrompt(byModule: Record<string, string>): string | null {
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(byModule)) {
    if (typeof k === "string" && k.trim() && typeof v === "string" && v.trim()) {
      filtered[k.trim()] = v.trim();
    }
  }
  if (Object.keys(filtered).length === 0) return null;
  return JSON.stringify(filtered);
}

/**
 * Obtiene el custom prompt del lead para un módulo (clave case-insensitive).
 */
export function getModuleCustomPrompt(
  parsed: ParsedLeadCustomPrompt,
  moduleKey: string
): string | null {
  if (!moduleKey?.trim()) return null;
  const norm = moduleKey.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  const key = Object.keys(parsed.byModule).find(
    (k) => k.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_") === norm
  );
  if (key) return parsed.byModule[key] || null;
  return parsed.byModule[moduleKey] ?? null;
}
