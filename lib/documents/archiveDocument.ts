/**
 * Archivado central: PDF desde export Gamma efímero → bucket `documents` → persistencia oficial en lead_documents (+ espejo leads).
 * Gamma genera; el CRM conserva (url / file_url / status).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStableArchivedDocumentUrlForType,
  upsertLeadDocumentUrl,
  type LeadDocumentType,
} from "@/lib/leads/leadDocuments";
import { isTransientGammaExportPdfUrl } from "@/lib/leads/presentationUtils";

export const DOCUMENTS_BUCKET = "documents";
const MAX_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 120_000;

export type ArchiveGammaExportResult =
  | { ok: true; publicUrl: string; storagePath: string }
  | { ok: false; error: string; storagePath?: string; suggestRegenerate?: boolean };

function finalUrlStillAllowed(finalUrl: string): boolean {
  return isTransientGammaExportPdfUrl(finalUrl);
}

/**
 * A) URL temporal Gamma → B) fetch servidor → C) validar PDF → D) upload → E) URL pública → F–G) DB.
 */
export async function archiveGammaExportPdfToDocuments(params: {
  sb: SupabaseClient;
  leadId: string;
  type: LeadDocumentType;
  sourceUrl: string;
  generationId: string | null;
  persist: boolean;
}): Promise<ArchiveGammaExportResult> {
  const sourceUrlRaw = params.sourceUrl.trim();
  console.info("[archiveDocument] inicio archivado Gamma", {
    leadId: params.leadId,
    type: params.type,
    persist: params.persist,
    sourceHost: (() => {
      try {
        return new URL(sourceUrlRaw).hostname;
      } catch {
        return "invalid";
      }
    })(),
  });

  if (!sourceUrlRaw || !isTransientGammaExportPdfUrl(sourceUrlRaw)) {
    console.warn("[archiveDocument] URL no es export PDF Gamma permitido");
    return { ok: false, error: "La URL no es un export PDF efímero de Gamma." };
  }

  if (params.persist) {
    const already = await getStableArchivedDocumentUrlForType(params.sb, params.leadId, params.type);
    if (already) {
      console.info("[archiveDocument] ya archivado en CRM; no se descarga ni inserta de nuevo", {
        type: params.type,
      });
      return { ok: true, publicUrl: already, storagePath: "" };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let fetchRes: Response;
  try {
    fetchRes = await fetch(sourceUrlRaw, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/pdf,*/*",
        "User-Agent": "CamaraCostaGammaArchive/1.0",
      },
    });
  } catch (e: unknown) {
    clearTimeout(timeout);
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error("[archiveDocument] descarga Gamma falló", { aborted, message: e instanceof Error ? e.message : String(e) });
    return {
      ok: false,
      error: aborted ? "Tiempo de espera al descargar el PDF." : "No se pudo descargar el PDF desde Gamma.",
      suggestRegenerate: true,
    };
  }
  clearTimeout(timeout);

  if (!fetchRes.ok) {
    console.error("[archiveDocument] Gamma HTTP error", { status: fetchRes.status });
  } else {
    console.info("[archiveDocument] descarga Gamma OK", { status: fetchRes.status });
  }

  const finalUrl = fetchRes.url || sourceUrlRaw;
  if (!finalUrlStillAllowed(finalUrl)) {
    return { ok: false, error: "La descarga redirigió a una URL no permitida.", suggestRegenerate: true };
  }

  if (!fetchRes.ok) {
    const expired = fetchRes.status === 403 || fetchRes.status === 401;
    return {
      ok: false,
      error: expired
        ? "Gamma denegó el acceso al PDF (enlace expirado o privado)."
        : `Gamma respondió ${fetchRes.status} al descargar el PDF.`,
      suggestRegenerate: true,
    };
  }

  const buf = Buffer.from(await fetchRes.arrayBuffer());
  if (buf.length === 0) {
    console.error("[archiveDocument] cuerpo vacío");
    return { ok: false, error: "El archivo descargado está vacío.", suggestRegenerate: true };
  }
  if (buf.length > MAX_BYTES) {
    return { ok: false, error: "El PDF supera el tamaño máximo permitido (50MB)." };
  }
  if (!buf.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    console.error("[archiveDocument] cabecera no PDF");
    return { ok: false, error: "La respuesta no es un PDF válido.", suggestRegenerate: true };
  }

  const { leadId, type, generationId, persist, sb } = params;
  const docPiece = crypto.randomUUID();
  const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const path = `leads/${leadId}/${type}/${ts}_${docPiece}.pdf`;

  const { error: upErr } = await sb.storage.from(DOCUMENTS_BUCKET).upload(path, buf, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (upErr) {
    console.error("[archiveDocument] upload storage falló", upErr);
    return {
      ok: false,
      error:
        "No se pudo guardar el PDF en el almacenamiento. Comprobá el bucket «documents» y las políticas de Storage.",
    };
  }
  console.info("[archiveDocument] upload storage OK", { path });

  const { data: pub } = sb.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl?.trim() ?? "";
  if (!publicUrl) {
    await sb.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => {});
    console.error("[archiveDocument] getPublicUrl vacío");
    return { ok: false, error: "No se pudo generar la URL pública del archivo." };
  }

  if (persist) {
    console.info("[archiveDocument] persistiendo lead_documents + leads", { type });
    const { error: persistErr } = await upsertLeadDocumentUrl(sb, leadId, type, publicUrl, generationId, {
      source: "gamma",
      gammaUrl: sourceUrlRaw,
      fileUrl: publicUrl,
      status: "archived",
    });
    if (persistErr) {
      console.error("[archiveDocument] upsert lead_documents / leads falló", persistErr);
      await sb.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => {});
      return { ok: false, error: persistErr, storagePath: path };
    }
    console.info("[archiveDocument] persistencia OK", { publicUrl });
  }

  return { ok: true, publicUrl, storagePath: path };
}

/** Reexport para código que aún importe el nombre antiguo del bucket. */
export const GAMMA_ARCHIVE_BUCKET = DOCUMENTS_BUCKET;
