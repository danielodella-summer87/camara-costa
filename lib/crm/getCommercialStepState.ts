/**
 * Estado del paso comercial LEADS87 (propuesta → presentación → cierre).
 * Fuente de verdad: columnas del lead + documentos persistidos (fallback).
 */

import {
  isOfficialCrmPersistedDocumentUrl,
  isOfficialPresentationDocumentUrl,
} from "@/lib/leads/gammaDocumentPolicy";

export type CommercialStepState =
  | "no_proposal"
  | "proposal_pending_review"
  | "ready_for_presentation"
  | "presentation_ready"
  | "closing";

export type CommercialStepLeadInput = {
  proposal_doc_url?: string | null;
  presentation_doc_url?: string | null;
  proposal_reviewed?: boolean | null;
  /** Persistido en DB como commercial_stage; alias opcional `stage` (p. ej. respuesta GET). */
  commercial_stage?: string | null;
  stage?: string | null;
};

function trimUrl(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizedCommercialStage(lead: CommercialStepLeadInput | null): string {
  if (!lead) return "";
  const raw =
    trimUrl(lead.commercial_stage) ||
    trimUrl((lead as { stage?: string | null }).stage);
  return raw.toLowerCase();
}

/**
 * Deriva el estado comercial lineal a partir del lead y, opcionalmente, URLs en `lead_documents`.
 *
 * Fuentes de verdad (en orden de merge por campo):
 * - Propuesta: `lead.proposal_doc_url` → `documents.proposal`
 * - Presentación: `lead.presentation_doc_url` → `documents.presentation`
 * - Revisión: `lead.proposal_reviewed` (boolean)
 * - Cierre: `lead.commercial_stage === 'closing'` (o alias `stage`)
 */
export function getCommercialStepState(
  lead: CommercialStepLeadInput | null,
  documents?: { proposal?: string | null; presentation?: string | null } | null
): CommercialStepState {
  if (normalizedCommercialStage(lead) === "closing") {
    return "closing";
  }

  const proposalRaw = trimUrl(lead?.proposal_doc_url) || trimUrl(documents?.proposal);
  const proposalUrl = proposalRaw && isOfficialCrmPersistedDocumentUrl(proposalRaw) ? proposalRaw : "";
  const presentationRaw = trimUrl(lead?.presentation_doc_url) || trimUrl(documents?.presentation);
  const presentationUrl =
    presentationRaw && isOfficialPresentationDocumentUrl(presentationRaw) ? presentationRaw : "";

  if (!proposalUrl) return "no_proposal";
  if (lead?.proposal_reviewed !== true) return "proposal_pending_review";
  if (!presentationUrl) return "ready_for_presentation";
  return "presentation_ready";
}

/** Texto del CTA principal verde del hero para el paso comercial (5–6). */
export function commercialStepHeroPrimaryLabel(state: CommercialStepState): string {
  switch (state) {
    case "no_proposal":
      return "Generar propuesta comercial";
    case "proposal_pending_review":
      return "Revisar propuesta comercial 1/3";
    case "ready_for_presentation":
      return "Generar presentación comercial";
    case "presentation_ready":
      return "Avanzar a cierre";
    case "closing":
      return "Seguimiento y cierre";
  }
}
