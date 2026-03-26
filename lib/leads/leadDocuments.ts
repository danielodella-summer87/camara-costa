import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  isDocumentsBucketPublicUrl,
  isOfficialCrmPersistedDocumentUrl,
  isOfficialPresentationDocumentUrl,
  isOtherAppStoragePublicUrl,
  isProposalMarkdownDataUrl,
  isTransientGammaExportPdfUrl,
} from "@/lib/leads/gammaDocumentPolicy";

export type LeadDocumentsResult = {
  diagnostic?: string;
  strategy?: string;
  proposal?: string;
  presentation?: string;
};

const DOC_TYPES = ["diagnostic", "strategy", "proposal", "presentation"] as const;
export type LeadDocumentType = (typeof DOC_TYPES)[number];

export type LeadDocumentArchiveEntry = {
  status: "archived" | "pending" | "failed" | "missing";
  officialUrl: string | null;
  gammaUrl: string | null;
  rawUrl: string | null;
};

export type UpsertLeadDocumentMeta = {
  source?: string;
  gammaUrl?: string | null;
  fileUrl?: string | null;
  status?: "pending" | "archived" | "failed";
  notes?: string | null;
  createdBy?: string | null;
  archivedAt?: string | null;
};

/** Resumen de una fila en `lead_documents` (historial / versión vigente). */
export type LeadDocumentVersionSummary = {
  id: string;
  type: LeadDocumentType;
  version_number: number;
  is_current: boolean;
  created_at: string;
  status: string | null;
};

export function isOfficialUrlForLeadDocumentType(type: LeadDocumentType, url: string): boolean {
  if (!url.trim()) return false;
  if (isTransientGammaExportPdfUrl(url)) return false;
  if (type === "presentation") return isOfficialPresentationDocumentUrl(url);
  return isOfficialCrmPersistedDocumentUrl(url);
}

function isOfficialForType(type: LeadDocumentType, url: string): boolean {
  return isOfficialUrlForLeadDocumentType(type, url);
}

/** URL que puede abrirse como documento oficial CRM (no Gamma efímera). */
function resolveOfficialOpenUrl(
  type: LeadDocumentType,
  url: string | null | undefined,
  fileUrl: string | null | undefined,
  statusRaw: string | null | undefined
): string | null {
  const st = (statusRaw ?? "").trim().toLowerCase();
  if (st === "failed") return null;
  const f = typeof fileUrl === "string" ? fileUrl.trim() : "";
  const u = typeof url === "string" ? url.trim() : "";
  if (f && isOfficialForType(type, f)) return f;
  if (u && isOfficialForType(type, u)) return u;
  return null;
}

function buildArchiveEntry(
  type: LeadDocumentType,
  row: {
    url: string | null;
    file_url?: string | null;
    gamma_url?: string | null;
    status?: string | null;
  } | null
): LeadDocumentArchiveEntry {
  if (!row) {
    return { status: "missing", officialUrl: null, gammaUrl: null, rawUrl: null };
  }
  const rawUrl = typeof row.url === "string" ? row.url.trim() : "";
  const gammaCol = typeof row.gamma_url === "string" ? row.gamma_url.trim() : "";
  const official = resolveOfficialOpenUrl(type, row.url, row.file_url, row.status);
  if (official) {
    return {
      status: "archived",
      officialUrl: official,
      gammaUrl: gammaCol || null,
      rawUrl: rawUrl || null,
    };
  }
  const dbStatus = (row.status ?? "").trim().toLowerCase();
  if (dbStatus === "failed") {
    return {
      status: "failed",
      officialUrl: null,
      gammaUrl: gammaCol || null,
      rawUrl: rawUrl || null,
    };
  }
  const hasTransient = isTransientGammaExportPdfUrl(rawUrl) || isTransientGammaExportPdfUrl(gammaCol);
  if (hasTransient || dbStatus === "pending") {
    return {
      status: "pending",
      officialUrl: null,
      gammaUrl: gammaCol || (isTransientGammaExportPdfUrl(rawUrl) ? rawUrl : null),
      rawUrl: rawUrl || null,
    };
  }
  if (rawUrl) {
    return {
      status: "pending",
      officialUrl: null,
      gammaUrl: gammaCol || null,
      rawUrl,
    };
  }
  return { status: "missing", officialUrl: null, gammaUrl: null, rawUrl: null };
}

function emptyArchiveMap(): Record<LeadDocumentType, LeadDocumentArchiveEntry> {
  return {
    diagnostic: { status: "missing", officialUrl: null, gammaUrl: null, rawUrl: null },
    strategy: { status: "missing", officialUrl: null, gammaUrl: null, rawUrl: null },
    proposal: { status: "missing", officialUrl: null, gammaUrl: null, rawUrl: null },
    presentation: { status: "missing", officialUrl: null, gammaUrl: null, rawUrl: null },
  };
}

/**
 * Documentos oficiales (URLs abribles) + estado de archivado por tipo (para UI y recuperación legacy).
 * Solo filas `is_current` (versión vigente por tipo).
 */
export async function getLeadDocumentsPayload(
  sb: SupabaseClient,
  leadId: string,
  options?: { includeVersionSummaries?: boolean }
): Promise<{
  documents: LeadDocumentsResult;
  archiveByType: Record<LeadDocumentType, LeadDocumentArchiveEntry>;
  versionSummaries?: LeadDocumentVersionSummary[];
}> {
  const { data, error } = await sb
    .from("lead_documents")
    .select("type, url, file_url, gamma_url, status, created_at")
    .eq("lead_id", leadId.trim())
    .eq("is_current", true)
    .in("type", DOC_TYPES)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[leadDocuments] getLeadDocumentsPayload error", error);
    return {
      documents: {},
      archiveByType: emptyArchiveMap(),
      ...(options?.includeVersionSummaries ? { versionSummaries: [] as LeadDocumentVersionSummary[] } : {}),
    };
  }

  let versionSummaries: LeadDocumentVersionSummary[] | undefined;
  if (options?.includeVersionSummaries) {
    versionSummaries = await fetchLeadDocumentVersionSummaries(sb, leadId.trim());
  }

  const archiveByType = emptyArchiveMap();
  const documents: LeadDocumentsResult = {};

  for (const row of data ?? []) {
    const type = row.type as LeadDocumentType;
    if (!DOC_TYPES.includes(type)) continue;
    if (archiveByType[type].status !== "missing") continue;

    const entry = buildArchiveEntry(type, {
      url: typeof row.url === "string" ? row.url : null,
      file_url: (row as { file_url?: string | null }).file_url ?? null,
      gamma_url: (row as { gamma_url?: string | null }).gamma_url ?? null,
      status: (row as { status?: string | null }).status ?? null,
    });
    archiveByType[type] = entry;
    if (entry.officialUrl) {
      documents[type] = entry.officialUrl;
    }
  }

  return { documents, archiveByType, ...(versionSummaries ? { versionSummaries } : {}) };
}

async function fetchLeadDocumentVersionSummaries(
  sb: SupabaseClient,
  leadId: string
): Promise<LeadDocumentVersionSummary[]> {
  const { data, error } = await sb
    .from("lead_documents")
    .select("id, type, version_number, is_current, created_at, status")
    .eq("lead_id", leadId)
    .in("type", [...DOC_TYPES])
    .order("type", { ascending: true })
    .order("version_number", { ascending: false });

  if (error) {
    console.error("[leadDocuments] fetchLeadDocumentVersionSummaries", error);
    return [];
  }

  const out: LeadDocumentVersionSummary[] = [];
  for (const row of data ?? []) {
    const type = row.type as LeadDocumentType;
    if (!DOC_TYPES.includes(type)) continue;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!id) continue;
    const vn = Number((row as { version_number?: number }).version_number);
    out.push({
      id,
      type,
      version_number: Number.isFinite(vn) && vn > 0 ? vn : 1,
      is_current: Boolean((row as { is_current?: boolean }).is_current),
      created_at:
        typeof (row as { created_at?: string }).created_at === "string"
          ? (row as { created_at: string }).created_at
          : new Date().toISOString(),
      status:
        typeof (row as { status?: string | null }).status === "string"
          ? String((row as { status: string }).status).trim() || null
          : null,
    });
  }
  return out;
}

/**
 * Obtiene las URLs oficiales por tipo (solo almacenamiento propio / fuentes persistidas válidas).
 */
export async function getLeadDocuments(sb: SupabaseClient, leadId: string): Promise<LeadDocumentsResult> {
  const { documents } = await getLeadDocumentsPayload(sb, leadId);
  return documents;
}

/** Filas vigentes (`is_current`) en `lead_documents` por tipo. Incluye metadatos de archivado. */
export async function getLeadDocumentRows(
  sb: SupabaseClient,
  leadId: string
): Promise<
  Array<{
    type: LeadDocumentType;
    url: string;
    generation_id: string | null;
    file_url: string | null;
    gamma_url: string | null;
    status: string | null;
  }>
> {
  const { data, error } = await sb
    .from("lead_documents")
    .select("type, url, generation_id, file_url, gamma_url, status")
    .eq("lead_id", leadId.trim())
    .eq("is_current", true)
    .in("type", [...DOC_TYPES]);

  if (error) {
    console.error("[leadDocuments] getLeadDocumentRows", error);
    return [];
  }

  const out: Array<{
    type: LeadDocumentType;
    url: string;
    generation_id: string | null;
    file_url: string | null;
    gamma_url: string | null;
    status: string | null;
  }> = [];
  for (const row of data ?? []) {
    const t = row.type as LeadDocumentType;
    if (!DOC_TYPES.includes(t)) continue;
    const url = typeof row.url === "string" ? row.url.trim() : "";
    if (!url) continue;
    const gid = row.generation_id;
    out.push({
      type: t,
      url,
      generation_id: typeof gid === "string" && gid.trim() ? gid.trim() : null,
      file_url: typeof (row as { file_url?: string | null }).file_url === "string"
        ? String((row as { file_url?: string | null }).file_url).trim() || null
        : null,
      gamma_url: typeof (row as { gamma_url?: string | null }).gamma_url === "string"
        ? String((row as { gamma_url?: string | null }).gamma_url).trim() || null
        : null,
      status: typeof (row as { status?: string | null }).status === "string"
        ? String((row as { status?: string | null }).status).trim() || null
        : null,
    });
  }
  return out;
}

/** URL ya persistida y estable para el tipo (evita re-archivado y duplicados lógicos). */
export async function getStableArchivedDocumentUrlForType(
  sb: SupabaseClient,
  leadId: string,
  type: LeadDocumentType
): Promise<string | null> {
  const rows = await getLeadDocumentRows(sb, leadId.trim());
  const r = rows.find((x) => x.type === type);
  if (!r) return null;
  const f = r.file_url?.trim() ?? "";
  const u = r.url?.trim() ?? "";
  if (f && isOfficialUrlForLeadDocumentType(type, f)) return f;
  if (u && isOfficialUrlForLeadDocumentType(type, u)) return u;
  return null;
}

function formatSupabaseError(prefix: string, err: PostgrestError): string {
  const parts = [err.message, err.details, err.hint].filter(Boolean);
  const base = parts.join(" — ");
  return err.code ? `${prefix}: ${base} [${err.code}]` : `${prefix}: ${base}`;
}

function inferRowMetadata(
  trimmedUrl: string,
  type: LeadDocumentType,
  meta?: UpsertLeadDocumentMeta | null
): {
  source: string;
  gamma_url: string | null;
  file_url: string | null;
  status: "pending" | "archived" | "failed";
  urlColumn: string;
} {
  const explicitStatus = meta?.status;
  const explicitSource = meta?.source?.trim();
  const explicitGamma = meta?.gammaUrl?.trim() || null;
  const explicitFile = meta?.fileUrl?.trim() || null;

  let source = explicitSource || "crm";
  if (isProposalMarkdownDataUrl(trimmedUrl)) source = explicitSource || "leads87";

  let file_url = explicitFile;
  if (!file_url && (isDocumentsBucketPublicUrl(trimmedUrl) || isOtherAppStoragePublicUrl(trimmedUrl))) {
    file_url = trimmedUrl;
  }

  let gamma_url = explicitGamma;
  if (!gamma_url && isTransientGammaExportPdfUrl(trimmedUrl)) {
    gamma_url = trimmedUrl;
  }

  let status: "pending" | "archived" | "failed";
  if (explicitStatus) {
    status = explicitStatus;
  } else if (isProposalMarkdownDataUrl(trimmedUrl)) {
    status = "archived";
  } else if (isDocumentsBucketPublicUrl(trimmedUrl) || isOtherAppStoragePublicUrl(trimmedUrl)) {
    status = "archived";
  } else if (isTransientGammaExportPdfUrl(trimmedUrl)) {
    status = "pending";
  } else if (/^https?:\/\//i.test(trimmedUrl)) {
    status = "archived";
  } else {
    status = "pending";
  }

  const urlColumn = trimmedUrl;

  return { source, gamma_url, file_url, status, urlColumn };
}

function mirrorUrlForLeadsTable(
  type: LeadDocumentType,
  trimmedUrl: string,
  meta?: UpsertLeadDocumentMeta | null
): string | null {
  const f = meta?.fileUrl?.trim();
  if (f && !isTransientGammaExportPdfUrl(f)) {
    if (type === "presentation") return isOfficialPresentationDocumentUrl(f) ? f : null;
    if (type === "proposal") return isOfficialCrmPersistedDocumentUrl(f) ? f : null;
  }
  if (isTransientGammaExportPdfUrl(trimmedUrl)) return null;
  if (type === "presentation") return isOfficialPresentationDocumentUrl(trimmedUrl) ? trimmedUrl : null;
  if (type === "proposal") return isOfficialCrmPersistedDocumentUrl(trimmedUrl) ? trimmedUrl : null;
  return null;
}

/**
 * Nueva versión en `lead_documents` (RPC atómica) y sincroniza columnas en `leads` (proposal/presentation).
 * Mantiene historial: versiones anteriores del mismo tipo quedan con `is_current = false`.
 */
export async function upsertLeadDocumentUrl(
  sb: SupabaseClient,
  leadId: string,
  type: LeadDocumentType,
  url: string,
  generationId: string | null,
  meta?: UpsertLeadDocumentMeta | null
): Promise<{ error: string | null }> {
  const trimmedUrl = url.trim();
  if (!leadId?.trim()) {
    console.error("[leadDocuments] upsertLeadDocumentUrl: lead_id vacío");
    return { error: "lead_id es obligatorio" };
  }
  if (!DOC_TYPES.includes(type)) {
    console.error("[leadDocuments] upsertLeadDocumentUrl: type inválido", type);
    return { error: `type inválido: ${type}` };
  }
  if (!trimmedUrl) {
    console.error("[leadDocuments] upsertLeadDocumentUrl: url vacía");
    return { error: "url es obligatoria" };
  }

  const inferred = inferRowMetadata(trimmedUrl, type, meta);
  const notes = meta?.notes?.trim() || null;
  const createdBy = meta?.createdBy?.trim() || null;
  const archivedAt = meta?.archivedAt?.trim() || null;

  console.info("[leadDocuments] insert_lead_document_version → payload", {
    lead_id: leadId.trim(),
    type,
    status: inferred.status,
    source: inferred.source,
    has_gamma_url: Boolean(inferred.gamma_url),
    has_file_url: Boolean(inferred.file_url),
  });

  const stableExisting = await getStableArchivedDocumentUrlForType(sb, leadId.trim(), type);
  if (stableExisting && stableExisting === trimmedUrl) {
    console.info("[leadDocuments] upsert omitido: URL vigente ya coincide (idempotente)", { type });
    const leadPatch: Record<string, unknown> = {};
    const mirror = mirrorUrlForLeadsTable(type, trimmedUrl, meta);
    if (type === "proposal" && mirror) {
      leadPatch.proposal_doc_url = mirror;
      leadPatch.proposal_reviewed = false;
    } else if (type === "presentation" && mirror) {
      leadPatch.presentation_doc_url = mirror;
    }
    if (Object.keys(leadPatch).length > 0) {
      const { data: leadRows, error: leadErr } = await sb
        .from("leads")
        .update(leadPatch)
        .eq("id", leadId.trim())
        .select("id");
      if (leadErr) return { error: formatSupabaseError("leads", leadErr) };
      if (!leadRows?.length) {
        return {
          error:
            "leads: ninguna fila actualizada (¿lead_id inexistente o sin permiso?). Verificá que el UUID exista en public.leads.",
        };
      }
    }
    return { error: null };
  }

  const { error: docErr } = await sb.rpc("insert_lead_document_version", {
    p_lead_id: leadId.trim(),
    p_type: type,
    p_url: inferred.urlColumn,
    p_generation_id: generationId?.trim() || null,
    p_source: inferred.source,
    p_gamma_url: inferred.gamma_url,
    p_file_url: inferred.file_url,
    p_status: inferred.status,
    p_notes: notes,
    p_created_by: createdBy,
    p_archived_at: archivedAt,
  });

  if (docErr) {
    const dup =
      docErr.code === "23505" ||
      (docErr.message ?? "").toLowerCase().includes("duplicate") ||
      (docErr.message ?? "").includes("lead_documents_lead_id_type_key");
    if (dup) {
      const afterStable = await getStableArchivedDocumentUrlForType(sb, leadId.trim(), type);
      if (afterStable) {
        console.info("[leadDocuments] duplicado en DB tratado como ya archivado (sin error al usuario)", { type });
        const leadPatch: Record<string, unknown> = {};
        const mirror = mirrorUrlForLeadsTable(type, afterStable, meta);
        if (type === "proposal" && mirror) {
          leadPatch.proposal_doc_url = mirror;
        } else if (type === "presentation" && mirror) {
          leadPatch.presentation_doc_url = mirror;
        }
        if (Object.keys(leadPatch).length > 0) {
          await sb.from("leads").update(leadPatch).eq("id", leadId.trim());
        }
        return { error: null };
      }
    }
    console.error("[leadDocuments] insert_lead_document_version ← error", {
      message: docErr.message,
      details: docErr.details,
      hint: docErr.hint,
      code: docErr.code,
      type,
    });
    return { error: formatSupabaseError("lead_documents", docErr) };
  }

  console.info("[leadDocuments] insert_lead_document_version OK", { type, status: inferred.status });

  const leadPatch: Record<string, unknown> = {};
  const mirror = mirrorUrlForLeadsTable(type, trimmedUrl, meta);
  if (type === "proposal" && mirror) {
    leadPatch.proposal_doc_url = mirror;
    leadPatch.proposal_reviewed = false;
  } else if (type === "presentation" && mirror) {
    leadPatch.presentation_doc_url = mirror;
  }

  if (Object.keys(leadPatch).length > 0) {
    console.info("[leadDocuments] update leads → patch", JSON.stringify({ ...leadPatch, id: leadId.trim() }));
    const { data: leadRows, error: leadErr } = await sb
      .from("leads")
      .update(leadPatch)
      .eq("id", leadId.trim())
      .select("id");

    if (leadErr) {
      console.error("[leadDocuments] update leads ← error Supabase", {
        message: leadErr.message,
        details: leadErr.details,
        hint: leadErr.hint,
        code: leadErr.code,
        leadPatch,
        leadId: leadId.trim(),
      });
      return { error: formatSupabaseError("leads", leadErr) };
    }
    if (!leadRows?.length) {
      const msg =
        "leads: ninguna fila actualizada (¿lead_id inexistente o sin permiso?). Verificá que el UUID exista en public.leads.";
      console.error("[leadDocuments] update leads ← 0 filas", { leadId: leadId.trim(), leadPatch });
      return { error: msg };
    }
    console.info("[leadDocuments] update leads OK", { id: leadRows[0]?.id });
  }

  return { error: null };
}
