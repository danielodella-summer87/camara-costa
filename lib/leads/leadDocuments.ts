import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadDocumentsResult = {
  diagnostic?: string;
  strategy?: string;
  proposal?: string;
};

const DOC_TYPES = ["diagnostic", "strategy", "proposal"] as const;
export type LeadDocumentType = (typeof DOC_TYPES)[number];

/**
 * Obtiene las URLs de los documentos comerciales vigentes por tipo para un lead.
 * La tabla tiene un solo registro vigente por (lead_id, type); devuelve ese documento por tipo.
 */
export async function getLeadDocuments(
  sb: SupabaseClient,
  leadId: string
): Promise<LeadDocumentsResult> {
  const { data, error } = await sb
    .from("lead_documents")
    .select("type, url, created_at")
    .eq("lead_id", leadId)
    .in("type", DOC_TYPES)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[leadDocuments] getLeadDocuments error", error);
    return {};
  }

  const result: LeadDocumentsResult = {};
  for (const row of data ?? []) {
    const type = row.type as LeadDocumentType;
    if (DOC_TYPES.includes(type) && row.url && !result[type]) {
      result[type] = row.url;
    }
  }
  return result;
}
