/**
 * Tras una generación Gamma: esperar export PDF si hace falta, archivar en Storage `documents`
 * y persistir en lead_documents (+ espejo leads). Si solo hay enlace web, estado pending honesto.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveGammaExportPdfToDocuments } from "@/lib/documents/archiveDocument";
import { getGammaGenerationWithExportPdfWait } from "@/lib/integrations/gamma";
import { upsertLeadDocumentUrl, type LeadDocumentType } from "@/lib/leads/leadDocuments";
import { isGammaExternalOnlyUrl } from "@/lib/leads/gammaDocumentPolicy";
import { isTransientGammaExportPdfUrl } from "@/lib/leads/presentationUtils";

export type FinalizeGammaLeadDocumentResult =
  | { ok: true; kind: "archived"; publicUrl: string }
  | { ok: true; kind: "pending_gamma_web"; message: string }
  | { ok: false; error: string; suggestRegenerate?: boolean };

/**
 * Segunda pasada servidor: vuelve a consultar Gamma (con espera de export) y archiva o deja pending.
 */
export async function finalizeGammaLeadDocument(params: {
  sb: SupabaseClient;
  leadId: string;
  type: LeadDocumentType;
  generationId: string;
  /** Espera extra si `completed` llegó sin PDF aún (ms). */
  maxWaitAfterCompletedMs?: number;
}): Promise<FinalizeGammaLeadDocumentResult> {
  const { sb, leadId, type, generationId, maxWaitAfterCompletedMs } = params;
  const gid = generationId.trim();
  if (!gid) return { ok: false, error: "generationId vacío." };

  console.info("[finalizeGammaLeadDocument] inicio", { leadId: leadId.trim(), type, generationId: gid });

  const snap = await getGammaGenerationWithExportPdfWait(gid, {
    maxWaitAfterCompletedMs: maxWaitAfterCompletedMs ?? 75_000,
    pollIntervalMs: 2500,
  });

  if (snap.status === "failed") {
    return { ok: false, error: "Gamma marcó la generación como fallida.", suggestRegenerate: true };
  }

  const pdfUrl = snap.pdfUrl?.trim() || null;
  if (pdfUrl && isTransientGammaExportPdfUrl(pdfUrl)) {
    const archived = await archiveGammaExportPdfToDocuments({
      sb,
      leadId: leadId.trim(),
      type,
      sourceUrl: pdfUrl,
      generationId: gid,
      persist: true,
    });
    if (!archived.ok) {
      return {
        ok: false,
        error: archived.error,
        suggestRegenerate: archived.suggestRegenerate === true,
      };
    }
    console.info("[finalizeGammaLeadDocument] archivado OK", { publicUrl: archived.publicUrl });
    return { ok: true, kind: "archived", publicUrl: archived.publicUrl };
  }

  const gammaWeb = snap.gammaUrl?.trim() || null;
  if (gammaWeb && isGammaExternalOnlyUrl(gammaWeb)) {
    const { error: upErr } = await upsertLeadDocumentUrl(sb, leadId.trim(), type, gammaWeb, gid, {
      source: "gamma",
      gammaUrl: gammaWeb,
      fileUrl: null,
      status: "pending",
    });
    if (upErr) {
      return { ok: false, error: upErr };
    }
    console.info("[finalizeGammaLeadDocument] solo gamma web → pending", { type });
    return {
      ok: true,
      kind: "pending_gamma_web",
      message:
        "Gamma completó el deck pero aún no hay URL de export PDF. Quedó guardado el enlace web; reintentá en unos minutos o exportá manualmente desde Gamma.",
    };
  }

  return {
    ok: false,
    error:
      "No se obtuvo PDF de export ni enlace web de Gamma. Reintentá la generación o comprobá la API de Gamma.",
    suggestRegenerate: true,
  };
}
