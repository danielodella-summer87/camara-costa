/**
 * Motor de Prioridad Comercial.
 * Identifica qué leads requieren atención prioritaria hoy usando pipeline,
 * alertas, lead health, próxima acción, rating y días en etapa.
 */

import { getLeadHealth } from "./leadHealth";
import {
  daysInStage,
  getStalledThreshold,
  isProposalStage,
  isEarlyStage,
  isHotOpportunity,
  isLeads87FlowCompletedMetric,
  hasLeadNextAction,
  isLeadNextCommercialOverdue,
  formatLeadUnifiedNextAction,
  leadNextActionInput,
  type LeadForMetrics,
} from "./metrics";
import { getLeadNextActionResult, overdueWholeDaysFrom } from "./leadNextAction";
import { isLeadClosed } from "@/lib/leads/leadStatusPolicy";

export type CommercialPriorityLevel = "high" | "medium" | "low";

export type CommercialPriorityItem = {
  leadId: string;
  leadName: string;
  pipeline: string;
  priorityLevel: CommercialPriorityLevel;
  priorityScore: number;
  headline: string;
  reasons: string[];
  nextActionText?: string;
  leadHealthLabel?: string;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function isAdvancedStage(pipeline: string | null | undefined): boolean {
  const p = norm(pipeline ?? "");
  return (
    p.includes("propuesta") ||
    p.includes("reunión") ||
    p.includes("reunion") ||
    p.includes("negociación") ||
    p === "env propuesta" ||
    p === "propuesta enviada" ||
    p === "calificado"
  );
}

/** Días desde proposal_sent_at hasta hoy. */
function daysSinceProposalSent(proposalSentAt: string | null | undefined): number | null {
  if (!proposalSentAt) return null;
  const d = new Date(proposalSentAt);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000)));
}

/** Puntos por señal (sumamos desde 0). */
const SIGNALS = {
  overdue_action: 40,
  no_next_action: 25,
  proposal_no_response: 30,
  proposal_sent_no_response: 20,
  hot_stalled: 35,
  health_critical: 25,
  health_warning: 10,
  high_rating: 10,
  early_stage_stalled: 10,
  advanced_stage_stalled: 15,
  days_in_stage_base: 5,
  days_in_stage_max: 20,
};

/**
 * Calcula el score de prioridad comercial de un lead (0+).
 */
export function getPriorityScore(lead: LeadForMetrics): number {
  if (isLeadClosed(lead.pipeline)) return 0;
  if (isLeads87FlowCompletedMetric(lead)) return 0;

  let score = 0;
  const days = daysInStage(lead.updated_at, lead.created_at) ?? 0;
  const threshold = getStalledThreshold(lead.pipeline);
  const stalled = days > threshold;
  const hasNext = hasLeadNextAction(lead);
  const overdue = isLeadNextCommercialOverdue(lead);
  const health = getLeadHealth(lead);
  const rating = Number(lead.rating ?? 0);
  const highRating = Number.isFinite(rating) && rating >= 4;

  const daysSinceSent = daysSinceProposalSent((lead as LeadForMetrics & { proposal_sent_at?: string | null }).proposal_sent_at);
  const proposalSentNoResponse = (daysSinceSent ?? 0) > 3;

  if (overdue) score += SIGNALS.overdue_action;
  if (!hasNext) score += SIGNALS.no_next_action;
  if (proposalSentNoResponse) score += SIGNALS.proposal_sent_no_response;
  if (isProposalStage(lead.pipeline) && days > 7) score += SIGNALS.proposal_no_response;
  if (isHotOpportunity(lead) && (!hasNext || stalled)) score += SIGNALS.hot_stalled;
  if (health?.status === "critical") score += SIGNALS.health_critical;
  if (health?.status === "warning") score += SIGNALS.health_warning;
  if (highRating) score += SIGNALS.high_rating;
  if (isEarlyStage(lead.pipeline) && stalled) score += SIGNALS.early_stage_stalled;
  if (isAdvancedStage(lead.pipeline) && stalled) score += SIGNALS.advanced_stage_stalled;

  if (days > 0) {
    const extra = Math.min(
      SIGNALS.days_in_stage_max - SIGNALS.days_in_stage_base,
      Math.floor(days / 7) * 5
    );
    score += SIGNALS.days_in_stage_base + Math.max(0, extra);
  }

  return score;
}

/**
 * Nivel de prioridad según score.
 */
function getPriorityLevel(score: number): CommercialPriorityLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Headline corto para la prioridad (una frase).
 */
export function getPriorityHeadline(lead: LeadForMetrics, _context?: { score: number }): string {
  const hasNext = hasLeadNextAction(lead);
  const overdue = isLeadNextCommercialOverdue(lead);
  const days = daysInStage(lead.updated_at, lead.created_at) ?? 0;
  const threshold = getStalledThreshold(lead.pipeline);
  const stalled = days > threshold;
  const proposalSentAt = (lead as LeadForMetrics & { proposal_sent_at?: string | null }).proposal_sent_at;
  const daysSinceSent = daysSinceProposalSent(proposalSentAt);
  const proposalSentNoResponse = (daysSinceSent ?? 0) > 3;

  if (proposalSentNoResponse) return "Propuesta enviada sin respuesta";
  if (overdue && isProposalStage(lead.pipeline)) return "Propuesta sin respuesta + acción vencida";
  if (overdue) return "Acción vencida";
  if (isProposalStage(lead.pipeline) && days > 7) return "Propuesta sin respuesta";
  if (isHotOpportunity(lead) && (!hasNext || stalled)) return "Oportunidad caliente trabada";
  if (!hasNext && stalled) return "Sin próxima acción + estancado";
  if (!hasNext) return "Sin próxima acción";
  if (stalled && isEarlyStage(lead.pipeline)) return "Estancado en etapa temprana";
  if (stalled && isAdvancedStage(lead.pipeline)) return "Etapa avanzada sin movimiento";
  if (stalled) return "Lead crítico en seguimiento";
  return "Revisar seguimiento";
}

/**
 * Razones cortas (máximo 2–3).
 */
export function getPriorityReasons(lead: LeadForMetrics): string[] {
  const reasons: string[] = [];
  const hasNext = hasLeadNextAction(lead);
  const overdue = isLeadNextCommercialOverdue(lead);
  const days = daysInStage(lead.updated_at, lead.created_at) ?? 0;
  const threshold = getStalledThreshold(lead.pipeline);
  const stalled = days > threshold;
  const rating = Number(lead.rating ?? 0);
  const highRating = Number.isFinite(rating) && rating >= 4;
  const proposalSentAt = (lead as LeadForMetrics & { proposal_sent_at?: string | null }).proposal_sent_at;
  const daysSinceSent = daysSinceProposalSent(proposalSentAt);
  const proposalSentNoResponse = (daysSinceSent ?? 0) > 3;

  if (proposalSentNoResponse) reasons.push(`Propuesta enviada hace ${daysSinceSent} días sin respuesta`);
  if (overdue) {
    const na = getLeadNextActionResult(leadNextActionInput(lead));
    const d = overdueWholeDaysFrom(leadNextActionInput(lead));
    if (na.source === "agenda") {
      reasons.push(
        d > 0
          ? `Seguimiento en agenda vencido hace ${d} día${d === 1 ? "" : "s"}`
          : "Seguimiento en agenda con fecha u hora ya pasada"
      );
    } else {
      reasons.push(d > 0 ? `La próxima acción venció hace ${d} día${d === 1 ? "" : "s"}` : "La próxima acción está vencida");
    }
  }
  if (!hasNext) reasons.push("No tiene próxima acción en lead ni en agenda");
  if (stalled && days > 0) reasons.push(`Lleva ${days} días en etapa`);
  if (isProposalStage(lead.pipeline) && days > 7) reasons.push("Propuesta sin respuesta");
  if (isHotOpportunity(lead)) reasons.push("Rating alto");
  if (highRating && !reasons.some((r) => r.includes("Rating"))) reasons.push("Rating alto");

  return reasons.slice(0, 3);
}

/**
 * Lista de prioridades comerciales de hoy (leads ordenados por urgencia).
 */
export function getCommercialPriorities(
  leads: LeadForMetrics[],
  limit = 5
): CommercialPriorityItem[] {
  const active = leads.filter((l) => !isLeadClosed(l.pipeline) && !isLeads87FlowCompletedMetric(l));
  const pipelineLabel = (p: string | null) => (p ?? "").trim() || "Sin etapa";

  const items: CommercialPriorityItem[] = active.map((lead) => {
    const score = getPriorityScore(lead);
    const health = getLeadHealth(lead);
    const crm = pipelineLabel(lead.pipeline);
    const flow = (lead.leads87Flow?.stageLabel ?? "").trim();
    return {
      leadId: lead.id,
      leadName: lead.nombre ?? "—",
      pipeline: flow ? `${flow} · ${crm}` : crm,
      priorityLevel: getPriorityLevel(score),
      priorityScore: score,
      headline: getPriorityHeadline(lead, { score }),
      reasons: getPriorityReasons(lead),
      nextActionText: hasLeadNextAction(lead) ? formatLeadUnifiedNextAction(lead) : undefined,
      leadHealthLabel: health?.label,
    };
  });

  return items
    .filter((i) => i.priorityScore > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
}
