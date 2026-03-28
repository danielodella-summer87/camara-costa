/**
 * Fuente unificada de "próxima acción" para Dashboard: combina `leads.next_activity_*`
 * con la próxima fila pendiente de `socio_acciones` (misma tabla que Agenda).
 */

export type LeadNextActionStatus = "no_action" | "pending_future" | "pending_overdue" | "completed_only";

/** Próxima acción pendiente en agenda (socio_acciones), ya deduplicada por lead (la más próxima). */
export type PendingAgendaAccion = {
  tipo: string;
  fecha_limite: string;
  hora?: string | null;
};

export type LeadNextActionInput = {
  next_activity_type?: string | null;
  next_activity_at?: string | null;
  pending_agenda_accion?: PendingAgendaAccion | null;
};

export type LeadNextActionResult = {
  status: LeadNextActionStatus;
  /** Tipo en claves de lead (call, meeting, …) cuando se pudo mapear; si no, texto agenda. */
  effectiveType: string | null;
  /** ISO del instante más próximo, si existe. */
  effectiveAtIso: string | null;
  /** Si el hito elegido viene de agenda o del lead. */
  source: "lead" | "agenda" | "none";
};

const AGENDA_TIPO_TO_LEAD: Record<string, string> = {
  llamada: "call",
  call: "call",
  reunion: "meeting",
  reunión: "meeting",
  meeting: "meeting",
  propuesta: "proposal",
  proposal: "proposal",
  whatsapp: "whatsapp",
  email: "email",
  correo: "email",
  seguimiento: "followup",
  followup: "followup",
};

function normType(t: string | null | undefined): string {
  return (t ?? "").toString().trim().toLowerCase();
}

/** Mapea tipo de socio_acciones / agenda a next_activity_type del lead (para formatNextAction). */
export function agendaTipoToLeadActivityType(tipo: string | null | undefined): string {
  const k = normType(tipo);
  if (!k) return "followup";
  return AGENDA_TIPO_TO_LEAD[k] ?? k;
}

function leadHasMetaAction(typeNorm: string): boolean {
  return Boolean(typeNorm && typeNorm !== "none");
}

function parseIsoInstant(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.getTime();
}

/**
 * Instante de vencimiento de una fila agenda (fecha + hora). Hora por defecto inicio del día local.
 */
export function accionDueMs(fecha_limite: string, hora: string | null | undefined): number | null {
  const date = (fecha_limite ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const h = (hora ?? "").trim();
  const hm = /^\d{1,2}:\d{2}/.test(h) ? h.replace(/^(\d):/, "0$1:").slice(0, 5) : "09:00";
  const d = new Date(`${date}T${hm}:00`);
  if (!Number.isFinite(d.getTime())) return null;
  return d.getTime();
}

type Candidate = { at: number; typeKey: string; source: "lead" | "agenda" };

function collectCandidates(input: LeadNextActionInput): { candidates: Candidate[]; hasMetaWithoutDate: boolean } {
  const candidates: Candidate[] = [];
  let hasMetaWithoutDate = false;

  const typeNorm = normType(input.next_activity_type);
  if (leadHasMetaAction(typeNorm)) {
    const at = parseIsoInstant(input.next_activity_at ?? null);
    if (at != null) {
      candidates.push({ at, typeKey: typeNorm, source: "lead" });
    } else {
      hasMetaWithoutDate = true;
    }
  }

  const ag = input.pending_agenda_accion;
  if (ag?.fecha_limite) {
    const at = accionDueMs(ag.fecha_limite, ag.hora);
    if (at != null) {
      candidates.push({
        at,
        typeKey: agendaTipoToLeadActivityType(ag.tipo),
        source: "agenda",
      });
    }
  }

  return { candidates, hasMetaWithoutDate };
}

/**
 * Regla unificada: hay acción pendiente si el lead tiene tipo distinto de none o existe acción agenda pendiente.
 * Vencida = el instante más próximo (lead o agenda) es anterior a ahora.
 */
export function getLeadNextActionResult(input: LeadNextActionInput): LeadNextActionResult {
  const { candidates, hasMetaWithoutDate } = collectCandidates(input);
  const hasAgenda = Boolean(input.pending_agenda_accion?.fecha_limite);
  const typeNorm = normType(input.next_activity_type);
  const hasLeadMeta = leadHasMetaAction(typeNorm);

  if (candidates.length === 0) {
    if (hasMetaWithoutDate) {
      return {
        status: "pending_future",
        effectiveType: typeNorm,
        effectiveAtIso: null,
        source: "lead",
      };
    }
    if (hasAgenda) {
      return {
        status: "pending_future",
        effectiveType: agendaTipoToLeadActivityType(input.pending_agenda_accion?.tipo),
        effectiveAtIso: null,
        source: "agenda",
      };
    }
    return { status: "no_action", effectiveType: null, effectiveAtIso: null, source: "none" };
  }

  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].at < best.at) best = candidates[i];
  }

  const now = Date.now();
  const overdue = best.at < now;
  return {
    status: overdue ? "pending_overdue" : "pending_future",
    effectiveType: best.typeKey,
    effectiveAtIso: new Date(best.at).toISOString(),
    source: best.source,
  };
}

export function hasUnifiedNextAction(input: LeadNextActionInput): boolean {
  const r = getLeadNextActionResult(input);
  return r.status === "pending_future" || r.status === "pending_overdue";
}

export function isUnifiedNextActionOverdue(input: LeadNextActionInput): boolean {
  return getLeadNextActionResult(input).status === "pending_overdue";
}

/** Días enteros desde el vencimiento hasta hoy (para copy de alertas). */
export function overdueWholeDaysFrom(input: LeadNextActionInput): number {
  const r = getLeadNextActionResult(input);
  if (r.status !== "pending_overdue" || !r.effectiveAtIso) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(r.effectiveAtIso).getTime()) / (24 * 60 * 60 * 1000))
  );
}
