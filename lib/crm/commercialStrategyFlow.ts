/**
 * Reglas de gating: estrategia confirmada vs legado (solo documento PDF/Gamma archivado).
 */

import { isOfficialCrmPersistedDocumentUrl } from "@/lib/leads/gammaDocumentPolicy";
import type { CommercialStrategyStored } from "./commercialStrategyTypes";
import { COMMERCIAL_STRATEGY_FIELD_KEYS } from "./commercialStrategyTypes";

/** Subconjunto de documentos usado aquí (evita import circular con leadsOkMacroFlow). */
export type StrategyFlowDocuments = { strategy?: string | null } | null | undefined;

/** Mensaje del hero cuando se intenta ir a servicios sin estrategia cerrada (limpiar al aprobar). */
export const COMMERCIAL_STRATEGY_GATE_ERROR_MESSAGE =
  "Confirmá la estrategia comercial en el Paso 3 antes de avanzar a servicios.";

function hasStrategyApprovedTimestamp(lead: LeadStrategyFields | null | undefined): boolean {
  const v = lead?.strategy_approved_at as unknown;
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return true;
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  const s = String(v).trim();
  return s.length > 0 && s !== "null" && s !== "undefined";
}

export type LeadStrategyFields = {
  commercial_strategy_json?: unknown;
  strategy_approved_at?: string | null;
};

export function parseCommercialStrategyStored(raw: unknown): CommercialStrategyStored | null {
  if (raw == null) return null;
  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return null;
  }
  const gen = (obj.generated && typeof obj.generated === "object" ? obj.generated : {}) as Record<string, string>;
  const ed = (obj.edited && typeof obj.edited === "object" ? obj.edited : {}) as Record<string, string>;
  const ui = (obj.userInputs && typeof obj.userInputs === "object" ? obj.userInputs : {}) as CommercialStrategyStored["userInputs"];
  const out: CommercialStrategyStored = {
    generated: {},
    edited: {},
    userInputs: { ...ui },
  };
  for (const k of COMMERCIAL_STRATEGY_FIELD_KEYS) {
    if (typeof gen[k] === "string") out.generated[k] = gen[k];
    if (typeof ed[k] === "string") out.edited[k] = ed[k];
  }
  return out;
}

/** Hay JSON persistido del nuevo flujo (aunque sea borrador). */
export function hasCommercialStrategyJsonRecord(lead: LeadStrategyFields | null | undefined): boolean {
  const raw = lead?.commercial_strategy_json;
  if (raw == null) return false;
  if (typeof raw === "string") return raw.trim().length > 0 && raw.trim() !== "{}";
  if (typeof raw === "object") {
    const p = parseCommercialStrategyStored(raw);
    if (!p) return false;
    const hasGen = COMMERCIAL_STRATEGY_FIELD_KEYS.some((k) => (p.generated[k] ?? "").trim().length > 0);
    const hasEd = COMMERCIAL_STRATEGY_FIELD_KEYS.some((k) => (p.edited[k] ?? "").trim().length > 0);
    return hasGen || hasEd || Object.keys(p.userInputs).length > 0;
  }
  return false;
}

function legacyStrategyDocumentComplete(documents: StrategyFlowDocuments): boolean {
  const u = documents?.strategy ? String(documents.strategy).trim() : "";
  if (!u) return false;
  return isOfficialCrmPersistedDocumentUrl(u) || u.length > 0;
}

/**
 * Única fuente de verdad: estrategia comercial cerrada para LEADS87 (servicios y siguientes pasos).
 * - `strategy_approved_at` definido (string fecha ISO u otros serializados por API), o
 * - legado: sin JSON del nuevo flujo pero hay documento de estrategia persistido.
 */
export function isCommercialStrategyApproved(
  lead: LeadStrategyFields | null | undefined,
  documents: StrategyFlowDocuments = null
): boolean {
  if (!lead) return false;
  if (hasStrategyApprovedTimestamp(lead)) return true;
  if (!hasCommercialStrategyJsonRecord(lead) && legacyStrategyDocumentComplete(documents)) return true;
  return false;
}

/** Texto combinado (estrategia aprobada o borrador) para sugerir servicios. */
export function buildStrategyContextForServices(stored: CommercialStrategyStored | null): string {
  if (!stored) return "";
  const parts: string[] = [];
  for (const k of COMMERCIAL_STRATEGY_FIELD_KEYS) {
    const v = (stored.edited[k] ?? stored.generated[k] ?? "").trim();
    if (v) parts.push(`${k}: ${v}`);
  }
  const ui = stored.userInputs;
  if (ui.prioridad_negocio) parts.push(`prioridad_negocio: ${ui.prioridad_negocio}`);
  if (ui.urgencia) parts.push(`urgencia: ${ui.urgencia}`);
  if (ui.presupuesto) parts.push(`presupuesto: ${ui.presupuesto}`);
  if (ui.restricciones) parts.push(`restricciones: ${ui.restricciones}`);
  return parts.join("\n");
}
