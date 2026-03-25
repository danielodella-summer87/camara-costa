/**
 * Fases UX del paso Propuesta en LEADS87.
 * La revisión confirmada se persiste en `leads.proposal_reviewed` (sin sessionStorage).
 */

export type Leads87ProposalPhase = "NOT_CREATED" | "CREATED_REVIEW_PENDING" | "READY_FOR_PRESENTATION";

export function getLeads87ProposalPhase(
  proposalUrl: string | null | undefined,
  proposalReviewed: boolean
): Leads87ProposalPhase {
  const u = String(proposalUrl ?? "").trim();
  if (!u) return "NOT_CREATED";
  if (!proposalReviewed) return "CREATED_REVIEW_PENDING";
  return "READY_FOR_PRESENTATION";
}
