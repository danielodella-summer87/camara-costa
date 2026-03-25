"use client";

export type LegacyGammaRecoverItem = {
  type: "diagnostic" | "strategy" | "proposal" | "presentation";
  status: "skipped_stable" | "skipped_no_row" | "archived" | "failed";
  previousUrl?: string;
  publicUrl?: string;
  error?: string;
  suggestRegenerate?: boolean;
  notRecoverable?: boolean;
};

export type LegacyGammaRecoverResponse = {
  ok: boolean;
  error?: string;
  leadId?: string;
  results?: LegacyGammaRecoverItem[];
  summary?: { archived: number; failed: number; skipped: number };
};

const RECOVER_PATH = "/documents/recover-legacy";

/** Intenta archivar en Storage todas las URLs efímeras Gamma en lead_documents para este lead. */
export async function postRecoverLegacyDocuments(
  leadId: string,
  types?: Array<"diagnostic" | "strategy" | "proposal" | "presentation">
): Promise<LegacyGammaRecoverResponse> {
  const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}${RECOVER_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(types?.length ? { types } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as LegacyGammaRecoverResponse;
  if (!res.ok) {
    return { ok: false, error: json.error ?? `Error ${res.status}` };
  }
  return json;
}

/** @deprecated Usar `postRecoverLegacyDocuments`. Misma acción (endpoint canónico recover-legacy). */
export const postRecoverLegacyGammaDocuments = postRecoverLegacyDocuments;
