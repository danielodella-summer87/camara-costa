/**
 * Utilidades para la vista de presentación al cliente (embed vs popup).
 */

export type PresentationDocs = {
  diagnostic?: string | null;
  strategy?: string | null;
  proposal?: string | null;
  /** URL del documento de presentación para el cliente (Paso 6). Si no existe, el front puede usar proposal como fallback. */
  presentation?: string | null;
};

const EMBED_BLOCKING_HOSTS = ["gamma.app", "gamma.co", "docs.google.com", "canva.com"];

/** True si la URL apunta a un PDF (por extensión o path). */
export function isPdfUrl(url: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  return u.endsWith(".pdf") || u.includes(".pdf?") || u.includes(".pdf#");
}

/**
 * True si la URL es same-origin respecto a currentOrigin (p. ej. window.location.origin)
 * y es un PDF. En SSR pasar currentOrigin vacío o no usar; en cliente pasar window.location.origin.
 */
export function isSameOriginPdfUrl(url: string | null, currentOrigin: string): boolean {
  if (!url || typeof url !== "string" || !currentOrigin) return false;
  try {
    return new URL(url.trim()).origin === currentOrigin && isPdfUrl(url);
  } catch {
    return false;
  }
}

/** True si la URL suele bloquear la visualización en iframe (X-Frame-Options, etc.). */
export function isLikelyEmbedBlocked(url: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return EMBED_BLOCKING_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

/** URL de presentación para el cliente (Paso 6). Prioridad: presentation → proposal → strategy → diagnostic. */
export function getPresentationPrimaryUrl(docs: PresentationDocs | null): string | null {
  if (!docs) return null;
  return docs.presentation ?? docs.proposal ?? docs.strategy ?? docs.diagnostic ?? null;
}

export const PRESENTATION_POPUP_FEATURES =
  "width=1400,height=900,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes";
export const PRESENTATION_POPUP_NAME = "leadPresentation";
