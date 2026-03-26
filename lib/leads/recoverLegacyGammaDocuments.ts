/**
 * Migración lógica: archiva URLs efímeras Gamma en lead_documents hacia Storage `documents`
 * y actualiza columnas espejo en leads (vía upsertLeadDocumentUrl).
 * No acepta URLs efímeras como válidas: solo las reemplaza por URLs propias tras archivar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLeadDocumentRows,
  getStableArchivedDocumentUrlForType,
  type LeadDocumentType,
} from "@/lib/leads/leadDocuments";
import { archiveGammaExportPdfToDocuments } from "@/lib/leads/archiveGammaExportToDocuments";
import { isTransientGammaExportPdfUrl } from "@/lib/leads/presentationUtils";
import { isProposalMarkdownDataUrl } from "@/lib/leads/gammaDocumentPolicy";

const ALL_TYPES: LeadDocumentType[] = ["diagnostic", "strategy", "proposal", "presentation"];

export type LegacyGammaRecoverItem = {
  type: LeadDocumentType;
  status: "skipped_stable" | "skipped_no_row" | "archived" | "failed";
  previousUrl?: string;
  publicUrl?: string;
  error?: string;
  suggestRegenerate?: boolean;
  /** Solo si no se pudo recuperar y conviene regenerar desde el flujo. */
  notRecoverable?: boolean;
};

export type RecoverLegacyGammaDocumentsResult = {
  leadId: string;
  results: LegacyGammaRecoverItem[];
  summary: { archived: number; failed: number; skipped: number };
};

/**
 * Para cada fila en lead_documents con URL de export PDF Gamma efímera, descarga, sube a Storage y persiste URL estable.
 * No lanza: los fallos van en `results` con status `failed`.
 */
export async function recoverLegacyGammaDocumentsForLead(
  sb: SupabaseClient,
  leadId: string,
  options?: { types?: LeadDocumentType[] }
): Promise<RecoverLegacyGammaDocumentsResult> {
  const trimmedId = leadId.trim();
  const fromOpts = (options?.types ?? []).filter((t): t is LeadDocumentType => ALL_TYPES.includes(t as LeadDocumentType));
  const requestedTypes = fromOpts.length > 0 ? fromOpts : ALL_TYPES;

  console.info("[recoverLegacyGammaDocuments] inicio", { leadId: trimmedId, requestedTypes });

  const rows = await getLeadDocumentRows(sb, trimmedId);
  const byType = new Map(rows.map((r) => [r.type, r]));
  const results: LegacyGammaRecoverItem[] = [];

  for (const type of requestedTypes) {
    const row = byType.get(type);
    if (!row) {
      console.info("[recoverLegacyGammaDocuments] omitido sin fila", { type });
      results.push({ type, status: "skipped_no_row" });
      continue;
    }

    const stableAlready = await getStableArchivedDocumentUrlForType(sb, trimmedId, type);
    if (stableAlready) {
      console.info("[recoverLegacyGammaDocuments] omitido: ya archivado (sin insert duplicado)", { type });
      results.push({
        type,
        status: "skipped_stable",
        previousUrl: row.url,
        publicUrl: stableAlready,
      });
      continue;
    }

    const url = row.url;
    if (isProposalMarkdownDataUrl(url)) {
      console.info("[recoverLegacyGammaDocuments] omitido estable (markdown)", { type });
      results.push({ type, status: "skipped_stable" });
      continue;
    }

    if (!isTransientGammaExportPdfUrl(url)) {
      console.info("[recoverLegacyGammaDocuments] omitido ya no efímero", { type });
      results.push({ type, status: "skipped_stable", previousUrl: url });
      continue;
    }

    console.info("[recoverLegacyGammaDocuments] procesando", { type, generation_id: row.generation_id });

    const archived = await archiveGammaExportPdfToDocuments({
      sb,
      leadId: trimmedId,
      type,
      sourceUrl: url,
      generationId: row.generation_id,
      persist: true,
    });

    if (archived.ok) {
      console.info("[recoverLegacyGammaDocuments] éxito", { type, publicUrl: archived.publicUrl });
      results.push({
        type,
        status: "archived",
        previousUrl: url,
        publicUrl: archived.publicUrl,
      });
    } else {
      console.error("[recoverLegacyGammaDocuments] error", {
        type,
        error: archived.error,
        suggestRegenerate: archived.suggestRegenerate,
      });
      results.push({
        type,
        status: "failed",
        previousUrl: url,
        error: archived.error,
        suggestRegenerate: archived.suggestRegenerate === true,
        notRecoverable: archived.suggestRegenerate === true,
      });
    }
  }

  const archivedCount = results.filter((r) => r.status === "archived").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const summary = {
    archived: archivedCount,
    failed: failedCount,
    skipped: results.length - archivedCount - failedCount,
  };

  console.info("[recoverLegacyGammaDocuments] fin", { leadId: trimmedId, summary });

  return { leadId: trimmedId, results, summary };
}
