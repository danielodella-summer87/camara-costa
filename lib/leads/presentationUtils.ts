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

export type ResolvedPresentationResource = {
  presentationDocumentUrl: string | null;
  gammaUrl: string | null;
  pdfUrl: string | null;
  temporaryPdfUrl: string | null;
  fallbackLinkedUrl: string | null;
  openUrl: string | null;
};

const EMBED_BLOCKING_HOSTS = ["gamma.app", "gamma.co", "docs.google.com", "canva.com"];

/** True si la URL apunta a un PDF (por extensión o path). */
export function isPdfUrl(url: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  return u.endsWith(".pdf") || u.includes(".pdf?") || u.includes(".pdf#");
}

function compactUrl(url: string | null | undefined): string | null {
  const value = (url ?? "").trim();
  return value.length > 0 ? value : null;
}

/** True si la URL se puede abrir como recurso real (http/https o ruta absoluta local). */
export function isOpenablePresentationUrl(url: string | null | undefined): boolean {
  const value = compactUrl(url);
  if (!value) return false;
  if (value.startsWith("/")) return true;
  if (/^https?:\/\//i.test(value)) return true;
  return false;
}

/** True si la URL parece ser un export PDF temporal/privado de Gamma (puede expirar o devolver AccessDenied). */
export function isTransientGammaExportPdfUrl(url: string | null | undefined): boolean {
  const value = compactUrl(url);
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      (host === "assets.api.gamma.app" || host.endsWith(".assets.api.gamma.app")) &&
      path.includes("/export/pdf/")
    );
  } catch {
    return false;
  }
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

/** URL de documento de presentación explícito (Paso 6) si existe. */
export function getPresentationDocumentUrl(docs: PresentationDocs | null): string | null {
  if (!docs) return null;
  return docs.presentation ?? null;
}

/** URL alternativa vinculada cuando no existe documento explícito de presentación. */
export function getPresentationFallbackLinkedUrl(docs: PresentationDocs | null): string | null {
  if (!docs) return null;
  return docs.proposal ?? docs.strategy ?? docs.diagnostic ?? null;
}

/** Fuente única para resolver qué recurso de presentación existe y cuál se debe abrir. */
export function resolvePresentationResource(
  docs: PresentationDocs | null,
  gammaUrl?: string | null,
  pdfUrl?: string | null
): ResolvedPresentationResource {
  const presentationDocumentUrlRaw = getPresentationDocumentUrl(docs);
  const fallbackLinkedUrlRaw = getPresentationFallbackLinkedUrl(docs);
  const gammaRaw = compactUrl(gammaUrl);
  const pdfRaw = compactUrl(pdfUrl);
  const presentationDocRaw = compactUrl(presentationDocumentUrlRaw);
  const fallbackRaw = compactUrl(fallbackLinkedUrlRaw);
  const resolved: ResolvedPresentationResource = {
    presentationDocumentUrl:
      isOpenablePresentationUrl(presentationDocRaw) && !isTransientGammaExportPdfUrl(presentationDocRaw)
        ? presentationDocRaw
        : null,
    gammaUrl:
      isOpenablePresentationUrl(gammaRaw) && !isTransientGammaExportPdfUrl(gammaRaw)
        ? gammaRaw
        : null,
    pdfUrl:
      isOpenablePresentationUrl(pdfRaw) && !isTransientGammaExportPdfUrl(pdfRaw)
        ? pdfRaw
        : null,
    temporaryPdfUrl:
      isOpenablePresentationUrl(pdfRaw) && isTransientGammaExportPdfUrl(pdfRaw)
        ? pdfRaw
        : null,
    fallbackLinkedUrl:
      isOpenablePresentationUrl(fallbackRaw) && !isTransientGammaExportPdfUrl(fallbackRaw)
        ? fallbackRaw
        : null,
    openUrl: null,
  };
  // Priorizar documentos persistidos / PDF estable antes que el deck solo en Gamma (política CRM).
  resolved.openUrl =
    resolved.presentationDocumentUrl ??
    resolved.pdfUrl ??
    resolved.fallbackLinkedUrl ??
    resolved.gammaUrl ??
    null;
  return resolved;
}

export const PRESENTATION_POPUP_FEATURES =
  "width=1400,height=900,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes";
export const PRESENTATION_POPUP_NAME = "leadPresentation";
