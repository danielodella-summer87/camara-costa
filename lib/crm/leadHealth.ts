/**
 * Lead Health Score (semáforo comercial).
 * Centraliza la lógica de estado de salud del lead para ficha, dashboard y futuro Kanban/Lista.
 */

import { daysInStage, getStalledThreshold } from "./metrics";

export type LeadHealthStatus = "good" | "warning" | "critical";

export type LeadHealthResult = {
  status: LeadHealthStatus;
  label: string;
  color: "green" | "yellow" | "red";
  score: number;
  reasons: string[];
};

export type LeadHealthInput = {
  pipeline?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  next_activity_type?: string | null;
  next_activity_at?: string | null;
  rating?: number | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

const CLOSED = new Set(["ganado", "perdido", "cerrado", "no interesado"]);

function hasNextAction(lead: LeadHealthInput): boolean {
  const t = (lead.next_activity_type ?? "").toString().trim().toLowerCase();
  return Boolean(t && t !== "none");
}

function isOverdue(nextActivityAt: string | null | undefined): boolean {
  if (!nextActivityAt) return false;
  const d = new Date(nextActivityAt);
  if (!Number.isFinite(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

function isEarlyStage(pipeline: string | null | undefined): boolean {
  const p = norm(pipeline ?? "");
  return p === "nuevo" || p === "contactado";
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

/**
 * Calcula el estado de salud comercial de un lead.
 * Score 0–100; semáforo: >=70 bien, 40–69 atención, <40 crítico.
 */
export function getLeadHealth(lead: LeadHealthInput | null): LeadHealthResult | null {
  if (!lead) return null;

  const pipelineNorm = norm(lead.pipeline ?? "");
  if (CLOSED.has(pipelineNorm)) {
    return {
      status: "good",
      label: "Cerrado",
      color: "green",
      score: 100,
      reasons: ["Lead en etapa final (ganado/perdido/cerrado)."],
    };
  }

  let score = 100;
  const reasons: string[] = [];

  const days = daysInStage(lead.updated_at, lead.created_at) ?? 0;
  const threshold = getStalledThreshold(lead.pipeline);
  const stalled = days > threshold;
  const hasNext = hasNextAction(lead);
  const overdue = hasNext && isOverdue(lead.next_activity_at);
  const early = isEarlyStage(lead.pipeline);
  const advanced = isAdvancedStage(lead.pipeline);
  const rating = Number(lead.rating ?? 0);
  const highRating = Number.isFinite(rating) && rating >= 4;

  if (!hasNext) {
    score -= 20;
    reasons.push("No tiene próxima acción");
  }

  if (overdue) {
    score -= 25;
    reasons.push("La próxima acción está vencida");
  }

  if (stalled) {
    const penalty = early && days > threshold * 1.5 ? 25 : 15;
    score -= penalty;
    reasons.push(`Lleva ${days} días en etapa`);
  }

  if (early && stalled) {
    score -= 10;
    if (!reasons.some((r) => r.includes("días en etapa"))) reasons.push("Estancado en etapa temprana");
  }

  if (early && !hasNext) {
    score -= 10;
  }

  if (hasNext && !overdue) {
    score += 5;
    reasons.push("Tiene próxima acción definida");
  }

  if (advanced && score >= 50) {
    score += 10;
    reasons.push("Está en etapa avanzada");
  }

  if (highRating && score >= 50) {
    score += 5;
    reasons.push("Oportunidad con buen rating");
  }

  score = Math.max(0, Math.min(100, score));

  let status: LeadHealthStatus = "good";
  let label = "Bien";
  let color: "green" | "yellow" | "red" = "green";

  if (score >= 70) {
    status = "good";
    label = "Bien";
    color = "green";
  } else if (score >= 40) {
    status = "warning";
    label = "Atención";
    color = "yellow";
  } else {
    status = "critical";
    label = "Crítico";
    color = "red";
  }

  const finalReasons = reasons.slice(0, 3);
  if (finalReasons.length === 0) {
    finalReasons.push(score >= 70 ? "Proceso en buen estado" : "Revisar seguimiento");
  }

  return {
    status,
    label,
    color,
    score,
    reasons: finalReasons,
  };
}

export type LeadHealthSummaryResult = {
  good: number;
  warning: number;
  critical: number;
  total: number;
};

/**
 * Resumen agregado de salud para el dashboard.
 */
export function getLeadHealthSummary(
  leads: LeadHealthInput[],
  options?: { excludeClosed?: boolean }
): LeadHealthSummaryResult {
  const excludeClosed = options?.excludeClosed ?? true;
  const CLOSED_SET = new Set(["ganado", "perdido", "cerrado", "no interesado"]);

  let good = 0;
  let warning = 0;
  let critical = 0;

  for (const lead of leads) {
    if (excludeClosed && CLOSED_SET.has(norm(lead.pipeline ?? ""))) continue;
    const result = getLeadHealth(lead);
    if (!result) continue;
    if (result.status === "good") good++;
    else if (result.status === "warning") warning++;
    else critical++;
  }

  return {
    good,
    warning,
    critical,
    total: good + warning + critical,
  };
}
