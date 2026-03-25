"use client";

import { isDocumentsBucketPublicUrl, isGammaExternalOnlyUrl } from "@/lib/leads/gammaDocumentPolicy";
import { isTransientGammaExportPdfUrl } from "@/lib/leads/presentationUtils";

/**
 * Recuperación masiva de URLs Gamma efímeras en `lead_documents` (migración lógica).
 * Server: `recoverLegacyGammaDocumentsForLead` en `@/lib/leads/recoverLegacyGammaDocuments`.
 * HTTP: `POST /api/admin/leads/[id]/documents/recover-legacy`
 */
export { postRecoverLegacyDocuments, postRecoverLegacyGammaDocuments } from "@/lib/leads/recoverLegacyGammaClient";

export type MirrorPdfDocType = "diagnostic" | "strategy" | "proposal" | "presentation";

/** Descarga el PDF desde Gamma en el servidor, lo guarda en Storage `documents` y devuelve la URL pública. */
export async function mirrorGammaPdfToDocuments(
  leadId: string,
  sourceUrl: string,
  type: MirrorPdfDocType,
  generationId: string | null,
  opts?: { persist?: boolean }
): Promise<string> {
  const persist = opts?.persist !== false;
  const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/documents/mirror-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ sourceUrl, type, generationId, persist }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    publicUrl?: string;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.publicUrl?.trim()) {
    throw new Error(json.error ?? "No se pudo archivar el PDF en almacenamiento propio.");
  }
  return json.publicUrl.trim();
}

/** Si `rawUrl` es un export temporal de Gamma, lo archiva y devuelve la URL estable; si no, devuelve la misma cadena. */
export async function resolveGammaPdfUrlForLead(
  leadId: string,
  rawUrl: string,
  type: MirrorPdfDocType,
  generationId: string | null
): Promise<string> {
  const u = rawUrl.trim();
  if (!u) throw new Error("URL vacía");
  if (!isTransientGammaExportPdfUrl(u)) return u;
  return mirrorGammaPdfToDocuments(leadId, u, type, generationId);
}

/** Servidor: espera export PDF, archiva en bucket `documents` o deja pending con enlace web. */
export async function finalizeGammaGenerationToDocuments(
  leadId: string,
  generationId: string,
  type: MirrorPdfDocType
): Promise<
  | { ok: true; kind: "archived"; publicUrl: string }
  | { ok: true; kind: "pending_gamma_web"; message: string }
  | { ok: false; error: string; suggestRegenerate?: boolean }
> {
  const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/documents/finalize-gamma`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ generationId, type }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    kind?: string;
    publicUrl?: string;
    message?: string;
    error?: string;
    suggestRegenerate?: boolean;
  };
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      error: json.error ?? "No se pudo finalizar el documento Gamma.",
      suggestRegenerate: json.suggestRegenerate === true,
    };
  }
  if (json.kind === "archived" && json.publicUrl?.trim()) {
    return { ok: true, kind: "archived", publicUrl: json.publicUrl.trim() };
  }
  if (json.kind === "pending_gamma_web") {
    return {
      ok: true,
      kind: "pending_gamma_web",
      message: json.message ?? "Gamma completó el deck pero aún no hay PDF de export.",
    };
  }
  return { ok: false, error: "Respuesta inesperada al finalizar Gamma." };
}

export type PersistGammaCompletedResult = {
  openUrl: string | null;
  error: string | null;
  pendingMessage: string | null;
  crmArchivedUrl: string | null;
};

/**
 * Tras `status === completed`: archiva PDF efímero, o reintenta vía finalize en servidor.
 * `crmArchivedUrl` es la URL del bucket `documents` cuando quedó persistida.
 */
export async function persistGammaCompletedStatus(
  leadId: string,
  type: MirrorPdfDocType,
  generationId: string | null,
  statusJson: { pdfUrl?: string | null; gammaUrl?: string | null }
): Promise<PersistGammaCompletedResult> {
  const pdf = typeof statusJson.pdfUrl === "string" ? statusJson.pdfUrl.trim() : "";
  const gamma = typeof statusJson.gammaUrl === "string" ? statusJson.gammaUrl.trim() : "";

  if (pdf && isTransientGammaExportPdfUrl(pdf)) {
    try {
      const stable = await mirrorGammaPdfToDocuments(leadId, pdf, type, generationId, { persist: true });
      return {
        openUrl: stable,
        crmArchivedUrl: stable,
        error: null,
        pendingMessage: null,
      };
    } catch (e) {
      if (generationId) {
        const fin = await finalizeGammaGenerationToDocuments(leadId, generationId, type);
        if (fin.ok && fin.kind === "archived") {
          return {
            openUrl: fin.publicUrl,
            crmArchivedUrl: fin.publicUrl,
            error: null,
            pendingMessage: null,
          };
        }
        if (fin.ok && fin.kind === "pending_gamma_web") {
          return {
            openUrl: gamma || null,
            crmArchivedUrl: null,
            error: null,
            pendingMessage: fin.message,
          };
        }
        return {
          openUrl: null,
          crmArchivedUrl: null,
          error: fin.ok === false ? fin.error : "No se pudo archivar el PDF.",
          pendingMessage: null,
        };
      }
      return {
        openUrl: null,
        crmArchivedUrl: null,
        error: e instanceof Error ? e.message : "No se pudo archivar el PDF.",
        pendingMessage: null,
      };
    }
  }

  if (pdf && /^https?:\/\//i.test(pdf) && !isTransientGammaExportPdfUrl(pdf)) {
    try {
      await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ type, url: pdf, generationId }),
      });
    } catch {
      /* seguir: abrir igual */
    }
    const crm = isDocumentsBucketPublicUrl(pdf) ? pdf : null;
    return { openUrl: pdf, crmArchivedUrl: crm, error: null, pendingMessage: null };
  }

  if (generationId) {
    const fin = await finalizeGammaGenerationToDocuments(leadId, generationId, type);
    if (fin.ok && fin.kind === "archived") {
      return {
        openUrl: fin.publicUrl,
        crmArchivedUrl: fin.publicUrl,
        error: null,
        pendingMessage: null,
      };
    }
    if (fin.ok && fin.kind === "pending_gamma_web") {
      return {
        openUrl: gamma || null,
        crmArchivedUrl: null,
        error: null,
        pendingMessage: fin.message,
      };
    }
    return {
      openUrl: null,
      crmArchivedUrl: null,
      error: fin.ok === false ? fin.error : "No se pudo finalizar la generación Gamma.",
      pendingMessage: null,
    };
  }

  if (gamma && isGammaExternalOnlyUrl(gamma)) {
    return {
      openUrl: gamma,
      crmArchivedUrl: null,
      error: null,
      pendingMessage:
        "Gamma devolvió solo el enlace web. El CRM intentará obtener el PDF en la siguiente sincronización o podés reintentar desde aquí.",
    };
  }

  return {
    openUrl: null,
    crmArchivedUrl: null,
    error: "No se recibió PDF de export ni enlace útil de Gamma.",
    pendingMessage: null,
  };
}
