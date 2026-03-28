/**
 * Helpers para métricas del Dashboard Comercial.
 * Lectura de avance / etapa LEADS87 vía `leads87Flow` (macro flow); el pipeline CRM queda como referencia secundaria donde aplica.
 */

import { isLeadActive } from "@/lib/leads/leadStatusPolicy";
import type { DashboardCommercialBucket } from "./dashboardCommercialFlow";
import {
  getLeadNextActionResult,
  hasUnifiedNextAction,
  isUnifiedNextActionOverdue,
  overdueWholeDaysFrom,
  type LeadNextActionInput,
  type PendingAgendaAccion,
} from "./leadNextAction";

export type LeadForMetrics = {
  id: string;
  nombre: string | null;
  pipeline: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  next_activity_type?: string | null;
  next_activity_at?: string | null;
  /** Próxima acción pendiente en socio_acciones (GET /api/admin/leads la adjunta). */
  pending_agenda_accion?: PendingAgendaAccion | null;
  rating?: number | null;
  proposal_confirmed_at?: string | null;
  proposal_sent_at?: string | null;
  /** Derivado de getLeadMacroFlowDisplay (misma fuente que ficha/listado LEADS87). */
  leads87Flow?: {
    progress: number;
    stageLabel: string;
    isFlowCompleted: boolean;
    bucket: DashboardCommercialBucket;
  };
  /** Duplicado para leadHealth / prioridad sin acoplar tipos. */
  leads87_flow_completed?: boolean;
};

/** Lead con flujo LEADS87 terminado (100%): no debe generar alertas de “falta avance” ni bajar KPIs. */
export function isLeads87FlowCompletedMetric(lead: LeadForMetrics): boolean {
  return Boolean(lead.leads87_flow_completed || lead.leads87Flow?.isFlowCompleted);
}

export function leadNextActionInput(lead: LeadForMetrics): LeadNextActionInput {
  return {
    next_activity_type: lead.next_activity_type,
    next_activity_at: lead.next_activity_at,
    pending_agenda_accion: lead.pending_agenda_accion ?? null,
  };
}

/** Hay al menos una acción pendiente: meta del lead o fila pendiente en agenda (socio_acciones). */
export function hasLeadNextAction(lead: LeadForMetrics): boolean {
  return hasUnifiedNextAction(leadNextActionInput(lead));
}

/** La acción más próxima (lead o agenda) ya pasó respecto de ahora. */
export function isLeadNextCommercialOverdue(lead: LeadForMetrics): boolean {
  return isUnifiedNextActionOverdue(leadNextActionInput(lead));
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Días desde la fecha de referencia (updated_at o created_at) hasta hoy. */
export function daysInStage(
  updatedAt: string | null | undefined,
  createdAt: string | null | undefined
): number | null {
  const iso = updatedAt ?? createdAt;
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

/** Umbrales de días por etapa para considerar un lead "estancado". */
const STALLED_DAYS: Record<string, number> = {
  nuevo: 5,
  contactado: 7,
  "en seguimiento": 14,
  calificado: 14,
  "propuesta enviada": 10,
  "env propuesta": 10,
  reunión: 14,
  "no interesado": 999,
  cerrado: 999,
  ganado: 999,
  perdido: 999,
};

const DEFAULT_STALLED_DAYS = 14;

export function getStalledThreshold(pipeline: string | null | undefined): number {
  const key = norm(pipeline ?? "");
  return STALLED_DAYS[key] ?? DEFAULT_STALLED_DAYS;
}

export function isLeadStalled(lead: LeadForMetrics): boolean {
  const days = daysInStage(lead.updated_at, lead.created_at);
  if (days == null) return false;
  const threshold = getStalledThreshold(lead.pipeline);
  return days > threshold;
}

export type StalledLead = {
  id: string;
  nombre: string | null;
  pipeline: string | null;
  daysInStage: number;
  leads87StageLabel?: string | null;
  leads87Progress?: number | null;
};

export function getStalledLeads(leads: LeadForMetrics[], limit = 10): StalledLead[] {
  return leads
    .filter((l) => {
      if (isLeads87FlowCompletedMetric(l)) return false;
      const days = daysInStage(l.updated_at, l.created_at);
      if (days == null) return false;
      const threshold = getStalledThreshold(l.pipeline);
      return days > threshold;
    })
    .map((l) => ({
      id: l.id,
      nombre: l.nombre,
      pipeline: l.pipeline,
      daysInStage: daysInStage(l.updated_at, l.created_at) ?? 0,
      leads87StageLabel: l.leads87Flow?.stageLabel ?? null,
      leads87Progress: l.leads87Flow?.progress ?? null,
    }))
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, limit);
}

export type PipelineCount = {
  pipeline: string;
  count: number;
};

export function getPipelineSummary(leads: LeadForMetrics[]): PipelineCount[] {
  const byPipeline = new Map<string, number>();
  for (const l of leads) {
    const p = (l.pipeline ?? "").trim() || "Sin etapa";
    byPipeline.set(p, (byPipeline.get(p) ?? 0) + 1);
  }
  return Array.from(byPipeline.entries())
    .map(([pipeline, count]) => ({ pipeline, count }))
    .sort((a, b) => b.count - a.count);
}

/** Orden lógico de etapas para conversión (primeras → últimas). */
const STAGE_ORDER = [
  "nuevo",
  "contactado",
  "en seguimiento",
  "calificado",
  "env propuesta",
  "propuesta enviada",
  "reunión",
  "cerrado",
  "ganado",
  "perdido",
  "no interesado",
];

function stageIndex(pipeline: string | null | undefined): number {
  const key = norm(pipeline ?? "");
  const i = STAGE_ORDER.indexOf(key);
  return i >= 0 ? i : 999;
}

export type ConversionPair = {
  from: string;
  to: string;
  percent: number | null;
};

export function getConversionMetrics(leads: LeadForMetrics[]): ConversionPair[] {
  const byStage = new Map<string, number>();
  for (const l of leads) {
    const p = (l.pipeline ?? "").trim() || "nuevo";
    const key = norm(p);
    byStage.set(key, (byStage.get(key) ?? 0) + 1);
  }

  const pairs: ConversionPair[] = [];
  const ordered = STAGE_ORDER.filter((s) => byStage.get(s) != null && byStage.get(s)! > 0);

  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i];
    const to = ordered[i + 1];
    const countFrom = byStage.get(from) ?? 0;
    const countToAndLater = ordered.slice(i + 1).reduce((sum, s) => sum + (byStage.get(s) ?? 0), 0);
    const total = countFrom + countToAndLater;
    const percent = total > 0 ? Math.round((countToAndLater / total) * 100) : null;
    pairs.push({
      from: from.charAt(0).toUpperCase() + from.slice(1),
      to: to.charAt(0).toUpperCase() + to.slice(1),
      percent,
    });
  }
  return pairs;
}

export function getTopOpportunities(leads: LeadForMetrics[], limit = 5): LeadForMetrics[] {
  return leads
    .filter((l) => isLeadActive(l.pipeline) && !isLeads87FlowCompletedMetric(l))
    .sort((a, b) => {
      const progA = a.leads87Flow?.progress ?? 0;
      const progB = b.leads87Flow?.progress ?? 0;
      if (progB !== progA) return progB - progA;
      const ratingA = Number(a.rating ?? 0);
      const ratingB = Number(b.rating ?? 0);
      if (ratingB !== ratingA) return ratingB - ratingA;
      const stageA = stageIndex(a.pipeline);
      const stageB = stageIndex(b.pipeline);
      if (stageA !== stageB) return stageB - stageA;
      const dateA = a.updated_at ?? a.created_at ?? "";
      const dateB = b.updated_at ?? b.created_at ?? "";
      return dateB.localeCompare(dateA);
    })
    .slice(0, limit);
}

/** Etapa relacionada con propuesta (propuesta enviada, negociación, etc.). */
export function isProposalStage(pipeline: string | null | undefined): boolean {
  const p = norm(pipeline ?? "");
  return (
    p.includes("propuesta") ||
    p.includes("negociación") ||
    p.includes("negociacion") ||
    p === "env propuesta" ||
    p === "propuesta enviada"
  );
}

/** Etapa temprana (Nuevo, Contactado). */
export function isEarlyStage(pipeline: string | null | undefined): boolean {
  const p = norm(pipeline ?? "");
  return p === "nuevo" || p === "contactado";
}

/** Oportunidad caliente: rating alto (>= 4) si existe el campo. */
export function isHotOpportunity(lead: LeadForMetrics): boolean {
  const r = Number(lead.rating ?? 0);
  return r >= 4 && Number.isFinite(r);
}

function isActiveLead(lead: LeadForMetrics): boolean {
  return isLeadActive(lead.pipeline);
}

export type CommercialAlertType =
  | "no_next_action"
  | "overdue_action"
  | "proposal_no_response"
  | "hot_stalled"
  | "early_stage_stalled";

export type CommercialAlert = {
  type: CommercialAlertType;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  leadId: string;
  leadName: string;
  pipeline: string;
  nextActionText?: string;
  daysInStage?: number;
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
const TYPE_ORDER: Record<CommercialAlertType, number> = {
  overdue_action: 0,
  hot_stalled: 1,
  proposal_no_response: 2,
  no_next_action: 3,
  early_stage_stalled: 4,
};

/** Genera alertas comerciales priorizadas. Máximo `limit` alertas. */
export function getCommercialAlerts(
  leads: LeadForMetrics[],
  limit = 8
): CommercialAlert[] {
  const active = leads.filter(isActiveLead);
  const out: CommercialAlert[] = [];

  for (const lead of active) {
    if (isLeads87FlowCompletedMetric(lead)) continue;

    const pipelineLabel = (lead.pipeline ?? "").trim() || "Sin etapa";
    const pipelineNorm = norm(lead.pipeline ?? "");
    const days = daysInStage(lead.updated_at, lead.created_at) ?? 0;

    if (isLeadNextCommercialOverdue(lead)) {
      const na = getLeadNextActionResult(leadNextActionInput(lead));
      const overdueDays = overdueWholeDaysFrom(leadNextActionInput(lead));
      const detail = formatLeadUnifiedNextAction(lead);
      const description =
        na.source === "agenda"
          ? overdueDays > 0
            ? `Seguimiento pendiente en agenda vencido hace ${overdueDays} día${overdueDays === 1 ? "" : "s"} (${detail}).`
            : `Seguimiento pendiente en agenda con fecha u hora ya pasada (${detail}).`
          : overdueDays > 0
            ? `La próxima acción está vencida desde hace ${overdueDays} día${overdueDays === 1 ? "" : "s"}.`
            : "La próxima acción está vencida.";
      out.push({
        type: "overdue_action",
        severity: "high",
        title: "Acción vencida",
        description,
        leadId: lead.id,
        leadName: lead.nombre ?? "—",
        pipeline: pipelineLabel,
        nextActionText: detail,
        daysInStage: days,
      });
    }

    if (isProposalStage(lead.pipeline) && days > 7) {
      out.push({
        type: "proposal_no_response",
        severity: "high",
        title: "Propuesta sin respuesta",
        description: `En etapa de propuesta hace ${days} días sin actualización.`,
        leadId: lead.id,
        leadName: lead.nombre ?? "—",
        pipeline: pipelineLabel,
        daysInStage: days,
      });
    }

    if (isHotOpportunity(lead) && (!hasLeadNextAction(lead) || days > getStalledThreshold(lead.pipeline))) {
      out.push({
        type: "hot_stalled",
        severity: "high",
        title: "Oportunidad caliente trabada",
        description: hasLeadNextAction(lead)
          ? `Alto potencial (rating ${lead.rating}) pero lleva ${days} días en etapa sin avance.`
          : "Alto potencial pero sin próxima acción definida.",
        leadId: lead.id,
        leadName: lead.nombre ?? "—",
        pipeline: pipelineLabel,
        daysInStage: days,
      });
    }

    if (!hasLeadNextAction(lead)) {
      out.push({
        type: "no_next_action",
        severity: "medium",
        title: "Lead sin próxima acción",
        description: "No tiene próxima acción en el lead ni en agenda (socio_acciones).",
        leadId: lead.id,
        leadName: lead.nombre ?? "—",
        pipeline: pipelineLabel,
        daysInStage: days,
      });
    }

    if (isEarlyStage(lead.pipeline)) {
      const threshold = pipelineNorm === "nuevo" ? 5 : 7;
      if (days > threshold) {
        out.push({
          type: "early_stage_stalled",
          severity: "medium",
          title: "Estancado en etapa temprana",
          description: `Lleva ${days} días en "${pipelineLabel}" (umbral: ${threshold} días).`,
          leadId: lead.id,
          leadName: lead.nombre ?? "—",
          pipeline: pipelineLabel,
          daysInStage: days,
        });
      }
    }
  }

  const seen = new Set<string>();
  const deduped: CommercialAlert[] = [];
  for (const a of out) {
    const key = `${a.leadId}:${a.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(a);
  }

  return deduped
    .sort((a, b) => {
      const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sev !== 0) return sev;
      const typeOrder = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
      if (typeOrder !== 0) return typeOrder;
      return (b.daysInStage ?? 0) - (a.daysInStage ?? 0);
    })
    .slice(0, limit);
}

export function formatNextAction(
  nextActivityType: string | null | undefined,
  nextActivityAt: string | null | undefined
): string {
  const type = (nextActivityType ?? "").toString().trim().toLowerCase();
  if (!type || type === "none") return "Sin próxima acción";
  const labels: Record<string, string> = {
    call: "Llamada",
    meeting: "Reunión",
    proposal: "Propuesta",
    whatsapp: "WhatsApp",
    email: "Email",
    followup: "Seguimiento",
  };
  const label = labels[type] ?? type;
  if (!nextActivityAt) return label;
  try {
    const d = new Date(nextActivityAt);
    if (Number.isFinite(d.getTime())) {
      const fmt = new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit" }).format(d);
      return `${label} ${fmt}`;
    }
  } catch {
    // ignore
  }
  return label;
}

/** Texto de próxima acción unificado (lead + agenda), para dashboard y listados. */
export function formatLeadUnifiedNextAction(lead: LeadForMetrics): string {
  const r = getLeadNextActionResult(leadNextActionInput(lead));
  if (r.status === "no_action") return "Sin próxima acción";
  return formatNextAction(r.effectiveType, r.effectiveAtIso);
}
