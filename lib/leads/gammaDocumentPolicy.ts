/**
 * Política CRM: Gamma es motor de generación, no repositorio oficial.
 * Solo URLs persistidas en almacenamiento propio (u orígenes aceptados) cuentan como documento válido.
 */

import { isTransientGammaExportPdfUrl } from "@/lib/leads/presentationUtils";

export { isTransientGammaExportPdfUrl };

/** Presentación o deck solo en la app Gamma (no es documento archivado en nuestro storage). */
export function isGammaExternalOnlyUrl(url: string | null | undefined): boolean {
  const v = (url ?? "").trim();
  if (!v) return false;
  try {
    const h = new URL(v).hostname.toLowerCase();
    return h === "gamma.app" || h.endsWith(".gamma.app") || h === "gamma.co" || h.endsWith(".gamma.co");
  } catch {
    return false;
  }
}

/** PDF efímero de Gamma o enlace solo-web: no debe persistirse como documento oficial vía POST /documents. */
export function isBlockedGammaSourceForPersistence(url: string | null | undefined): boolean {
  return isTransientGammaExportPdfUrl(url) || isGammaExternalOnlyUrl(url);
}

/** URL pública del bucket `documents` (archivado Gamma → storage propio). */
export function isDocumentsBucketPublicUrl(url: string | null | undefined): boolean {
  const v = (url ?? "").trim();
  if (!v) return false;
  try {
    return new URL(v).pathname.includes("/storage/v1/object/public/documents/");
  } catch {
    return false;
  }
}

/** Propuesta LEADS87 almacenada como data URL (markdown). */
export function isProposalMarkdownDataUrl(url: string | null | undefined): boolean {
  const v = (url ?? "").trim().toLowerCase();
  return v.startsWith("data:text/markdown") || v.startsWith("data:text/plain");
}

/** Otros buckets públicos de la app (PDFs subidos por flujos internos). */
export function isOtherAppStoragePublicUrl(url: string | null | undefined): boolean {
  const v = (url ?? "").trim();
  if (!v) return false;
  try {
    const p = new URL(v).pathname;
    return (
      p.includes("/storage/v1/object/public/lead-docs/") ||
      p.includes("/storage/v1/object/public/lead-proposals/")
    );
  } catch {
    return false;
  }
}

/**
 * Documento comercial persistido de forma aceptable para el CRM (diagnóstico, estrategia, propuesta).
 * Excluye fuentes Gamma no archivadas. Permite legacy https no-Gamma.
 */
export function isOfficialCrmPersistedDocumentUrl(url: string | null | undefined): boolean {
  const v = (url ?? "").trim();
  if (!v) return false;
  if (isBlockedGammaSourceForPersistence(v)) return false;
  if (isProposalMarkdownDataUrl(v)) return true;
  if (isDocumentsBucketPublicUrl(v)) return true;
  if (isOtherAppStoragePublicUrl(v)) return true;
  if (v.startsWith("/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Presentación comercial: más estricto — preferimos storage propio o ruta local;
 * enlaces https externos legacy se aceptan si ya no son Gamma.
 */
export function isOfficialPresentationDocumentUrl(url: string | null | undefined): boolean {
  const v = (url ?? "").trim();
  if (!v) return false;
  if (isBlockedGammaSourceForPersistence(v)) return false;
  if (isDocumentsBucketPublicUrl(v)) return true;
  if (isOtherAppStoragePublicUrl(v)) return true;
  if (v.startsWith("/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Señal de UI: hay PDF export Gamma aún no archivado. */
export function hasTransientGammaPdfSignal(pdfUrl: string | null | undefined): boolean {
  return isTransientGammaExportPdfUrl(pdfUrl);
}
