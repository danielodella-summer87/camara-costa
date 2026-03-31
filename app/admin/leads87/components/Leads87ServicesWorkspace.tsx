"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgencyLineSnapshot } from "@/lib/agencyServices/catalog";
import {
  computeLineFromEffortProfileRow,
  sumInternalCost,
  type InternalCostBreakdownLine,
} from "@/lib/agencyServices/internalCost";
import type { ServiceRecommendationRaw } from "@/lib/leads/serviceRecommendationEngine";

const AI_REC_STORAGE_PREFIX = "leads87.aiSvcRec.v1:";

type LeadServiceProposal = {
  id: string;
  service_id: string | null;
  agency_service_id?: string | null;
  codigo: string | null;
  nombre: string | null;
  mes: number;
  precio: number | null;
  moneda: string | null;
  alcance_editado: string | null;
  observaciones: string | null;
  billing_type?: string | null;
  agency_snapshot?: AgencyLineSnapshot | null;
};

type EasyService = {
  id: string;
  codigo: string;
  nombre: string;
  categoria?: string | null;
  descripcion_corta?: string | null;
  alcance_base?: string | null;
  precio_base?: number | null;
  moneda?: string | null;
  billing_type?: string | null;
  orden?: number | null;
  default_quantity?: number | null;
  unit?: string | null;
};

/** Tipo de facturación según catálogo / fila (para réplica mensual en borrador). */
type CatalogBillingKind = "monthly" | "one_time" | "project" | "hourly";

function normalizeCatalogBilling(raw: string | null | undefined): CatalogBillingKind {
  const b = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (b === "monthly") return "monthly";
  if (b === "hourly") return "hourly";
  if (b === "project") return "project";
  return "one_time";
}

function billingKindFromEasyService(s: EasyService): CatalogBillingKind {
  if (s.unit) {
    const u = String(s.unit).trim().toLowerCase();
    if (u === "monthly") return "monthly";
    if (u === "hour" || u === "hourly") return "hourly";
    if (u === "project") return "project";
    if (u === "one_time" || u === "one-time") return "one_time";
  }
  return normalizeCatalogBilling(s.billing_type);
}

/** Prioriza `unit` del catálogo agencia (hour, project, monthly, one_time) sobre billing_type reducido. */
function billingFromCatalogAndRow(cat: EasyService | null, r: LeadServiceProposal): CatalogBillingKind {
  if (cat) return billingKindFromEasyService(cat);
  return normalizeCatalogBilling(r.billing_type);
}

function catalogForProposalRow(r: LeadServiceProposal, catalog: EasyService[]): EasyService | null {
  const sid = (r.agency_service_id ?? r.service_id ?? "").trim();
  if (!sid) return null;
  return catalog.find((c) => c.id === sid) ?? null;
}

/** Borrador local de línea (sin PATCH hasta confirmar estructura). */
type ProposalRowDraft = {
  mes: number;
  /** Fin de actividad local (1-24) para prefill de sugeridos; no se persiste en backend. */
  activeUntilMonth?: number;
  unit_price: number;
  quantity: number;
  catalog_billing: CatalogBillingKind;
  /** Solo claves `m_1`… que el usuario editó; si falta, ese mes usa el subtotal automático (P. unit. × cant.). */
  monthValueOverrides?: Partial<Record<string, number>>;
};

function draftFromRow(r: LeadServiceProposal, catalog: EasyService[]): ProposalRowDraft {
  const snap = r.agency_snapshot;
  const qtyRaw = snap && Number(snap.quantity) > 0 ? Number(snap.quantity) : 1;
  const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
  const total = Number(r.precio ?? 0);
  const snapTotal = snap ? Number(snap.total_price) : NaN;
  const lineTotal = Number.isFinite(snapTotal) && snapTotal >= 0 ? snapTotal : total;
  let unit = snap && Number.isFinite(Number(snap.unit_price)) ? Number(snap.unit_price) : lineTotal / qty;
  if (!Number.isFinite(unit) || unit < 0) unit = 0;
  const mes = Math.max(1, Math.min(24, Math.round(Number(r.mes) || 1)));
  const cat = catalogForProposalRow(r, catalog);
  const catalog_billing = billingFromCatalogAndRow(cat, r);
  return { mes, unit_price: unit, quantity: qty, catalog_billing };
}

function lineSubtotal(d: ProposalRowDraft): number {
  const u = Number(d.unit_price);
  const q = Number(d.quantity);
  const su = Number.isFinite(u) && u >= 0 ? u : 0;
  const sq = Number.isFinite(q) && q > 0 ? q : 1;
  return su * sq;
}

/** Formato moneda para el resumen comercial (alineado a la moneda de la propuesta). */
function formatProposalCurrency(amount: number, currency: string | null | undefined): string {
  const raw = String(currency ?? "USD").trim().toUpperCase();
  const code = raw === "UYU" || raw === "USD" ? raw : "USD";
  try {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
}

function draftQuantityForCost(d: ProposalRowDraft): number {
  const q = Number(d.quantity);
  return Number.isFinite(q) && q > 0 ? q : 1;
}

/** Fin de horizonte de plan (1–24). */
function planEndClamped(planEndMonth: number): number {
  return Math.min(24, Math.max(1, Math.round(planEndMonth)));
}

function activeRangeEndMonth(d: ProposalRowDraft, planEndMonth: number): number {
  const end = planEndClamped(planEndMonth);
  if (d.activeUntilMonth == null || !Number.isFinite(Number(d.activeUntilMonth))) {
    return d.catalog_billing === "monthly" ? end : d.mes;
  }
  const localEnd = Math.max(d.mes, Math.min(24, Math.round(Number(d.activeUntilMonth))));
  return Math.min(end, localEnd);
}

/** La fila aporta importe en la columna del mes `m` (réplica mensual en borrador). */
function rowActiveInMonth(m: number, d: ProposalRowDraft, planEndMonth: number): boolean {
  const explicitEnd = activeRangeEndMonth(d, planEndMonth);
  if (explicitEnd > d.mes) return m >= d.mes && m <= explicitEnd;
  const end = planEndClamped(planEndMonth);
  if (d.catalog_billing === "monthly") return m >= d.mes && m <= end;
  return m === d.mes;
}

/** Cantidad de meses con importe para esta fila (para total general). */
function countSpreadMonths(d: ProposalRowDraft, planEndMonth: number): number {
  const explicitEnd = activeRangeEndMonth(d, planEndMonth);
  if (explicitEnd > d.mes) return explicitEnd - d.mes + 1;
  if (d.catalog_billing !== "monthly") return 1;
  const end = planEndClamped(planEndMonth);
  if (end < d.mes) return 0;
  return end - d.mes + 1;
}

/** Importe mostrado y sumado para la celda del mes `m` (1-based): override manual o automático. */
function effectiveMonthCellValue(
  d: ProposalRowDraft,
  colKey: string,
  m: number,
  planEndMonth: number
): number {
  if (!rowActiveInMonth(m, d, planEndMonth)) return 0;
  const auto = lineSubtotal(d);
  const raw = d.monthValueOverrides?.[colKey];
  if (raw !== undefined && Number.isFinite(raw)) return Math.max(0, raw);
  return auto;
}

function lineTotalInPlanWithOverrides(
  d: ProposalRowDraft,
  monthColumns: { key: string }[],
  planEndMonth: number
): number {
  const end = planEndClamped(planEndMonth);
  let t = 0;
  for (let m = 1; m <= end; m++) {
    if (!rowActiveInMonth(m, d, planEndMonth)) continue;
    const col = monthColumns[m - 1];
    if (!col) continue;
    t += effectiveMonthCellValue(d, col.key, m, planEndMonth);
  }
  return t;
}

function pruneMonthOverrides(
  d: ProposalRowDraft,
  monthColumns: { key: string }[],
  planEndMonth: number
): ProposalRowDraft["monthValueOverrides"] {
  const ov = d.monthValueOverrides;
  if (!ov) return undefined;
  const kept: Partial<Record<string, number>> = {};
  const end = planEndClamped(planEndMonth);
  for (let m = 1; m <= end; m++) {
    if (!rowActiveInMonth(m, d, planEndMonth)) continue;
    const k = monthColumns[m - 1]?.key;
    if (k != null && ov[k] !== undefined) kept[k] = ov[k]!;
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

function buildValuesByMonthForConfirm(
  d: ProposalRowDraft,
  cols: ReturnType<typeof getCols>,
  planEnd: number
): Record<string, number> {
  const valuesByMonth: Record<string, number> = {};
  const explicitEnd = activeRangeEndMonth(d, planEnd);
  if (explicitEnd > d.mes) {
    for (let m = d.mes; m <= explicitEnd; m++) {
      const col = cols[m - 1];
      if (col) valuesByMonth[col.key] = effectiveMonthCellValue(d, col.key, m, planEnd);
    }
    return valuesByMonth;
  }
  const end = planEndClamped(planEnd);
  if (d.catalog_billing === "monthly") {
    if (end >= d.mes) {
      for (let m = d.mes; m <= end; m++) {
        const col = cols[m - 1];
        if (col) valuesByMonth[col.key] = effectiveMonthCellValue(d, col.key, m, planEnd);
      }
    } else {
      const col = cols[Math.max(0, d.mes - 1)];
      if (col) valuesByMonth[col.key] = effectiveMonthCellValue(d, col.key, d.mes, planEnd);
    }
  } else {
    const col = cols[Math.max(0, d.mes - 1)];
    const key = col?.key ?? "m_1";
    valuesByMonth[key] = effectiveMonthCellValue(d, key, d.mes, planEnd);
  }
  return valuesByMonth;
}

function clampSuggestedActiveRange(startMonth: number, durationMonths: number, planHorizon: number): { start: number; end: number } {
  const horizon = planEndClamped(planHorizon);
  const start = Math.max(1, Math.min(24, Math.round(startMonth)));
  const duration = Math.max(1, Math.round(durationMonths));
  const end = Math.max(start, Math.min(horizon, start + duration - 1));
  return { start, end };
}

function billingLabelShort(b: CatalogBillingKind): string {
  switch (b) {
    case "monthly":
      return "Mensual";
    case "hourly":
      return "Por hora";
    case "project":
      return "Proyecto";
    default:
      return "Puntual";
  }
}

/** Tres líneas máx.: qué detectamos, por qué importa, qué mejora — sin redacción genérica tipo “el informe sugiere”. */
type CommercialPitch = {
  diagnosis: string;
  problem: string;
  impact: string;
};

type PitchKind = "strategy" | "demand" | "linkedin" | "web" | "content" | "seo";

/** Capa explícita: familia, variante, por qué encaja con diagnóstico/estrategia, duración esperada. */
type StrategicDecision = {
  familyLabel: string;
  variantLabel: string;
  strategicJustification: string;
  expectedDuration: string;
};

type Suggested = {
  service: EasyService;
  /** Clave de familia excluyente (`exclusiveFamilyId`). */
  family: string;
  /** Puntuación compuesta (mayor = más alineado a contexto comercial). */
  score: number;
  /** Motivos breves que justifican el score. */
  evidence: string[];
  strategicJustification: string;
  impact: string;
  priority: "alta" | "media" | "baja";
  pitch: CommercialPitch;
  decision: StrategicDecision;
  /** 1–3 señales muy cortas tomadas del texto (informe / estrategia / tabs), sin redacción genérica. */
  evidenceChips: string[];
  /** Por qué esta familia entró en la lista final (deduplicación estratégica). */
  familyDecisionReason: string;
  /** Por qué se eligió esta variante y no otra de la misma familia. */
  variantDecisionReason: string;
  /** Mes de inicio sugerido (1–24), solo orientativo; no modifica la grilla hasta que el usuario agregue/edite. */
  suggestedStartMonth: number;
  /** Cantidad de meses activos sugeridos dentro del horizonte. */
  suggestedDurationMonths: number;
  /** Por qué ese inicio y esa duración. */
  timingReason: string;
};

const DIAGNOSTIC_ANCHORS: Record<PitchKind, string[]> = {
  strategy: ["estrategia", "prioridad", "diagnostico", "diagnóstico", "foco", "hoja de ruta", "gap", "oportunidad", "crecimiento"],
  demand: ["pauta", "captacion", "captación", "tráfico", "trafico", "campaña", "inversión", "inversion", "performance", "ads", "meta", "google"],
  linkedin: ["linkedin", "b2b", "autoridad", "social selling", "organico", "orgánico"],
  web: ["web", "landing", "sitio", "conversión", "conversion", "ux", "experiencia"],
  seo: ["seo", "organico", "orgánico", "buscador", "visibilidad", "posicionamiento"],
  content: ["contenido", "blog", "editorial", "copy", "newsletter"],
};

function normForMatch(s: string): string {
  return normText(s);
}

/** Cuántas anclas del tema aparecen en el texto (diagnóstico + fuente). */
function countThemeAnchors(kind: PitchKind, pool: string): number {
  const t = normForMatch(pool);
  return DIAGNOSTIC_ANCHORS[kind].filter((a) => t.includes(normForMatch(a))).length;
}

/**
 * Validación estratégica antes de sugerir:
 * - Con estrategia aprobada: basta coherencia temática leve (≥1 ancla en pool ampliado).
 * - Sin estrategia: el diagnóstico/informe debe respaldar el tema con más de una señal (≥2 anclas) o excerpt fuerte.
 */
function passesStrategicValidation(
  kind: PitchKind,
  source: string,
  strategyApproved: boolean,
  strategyContextText: string,
  tabs: Record<string, string>
): boolean {
  const diagPool = [tabs.OPORTUNIDADES, tabs.ACCIONES, tabs.plan_crecimiento, tabs.diagnostico, tabs.DIAGNOSTICO]
    .filter(Boolean)
    .join("\n\n");
  const pool = `${source}\n${strategyContextText}\n${diagPool}`;
  const n = countThemeAnchors(kind, pool);
  if (strategyApproved) return n >= 1;
  return n >= 2;
}

/** Servicios de “inversión” fuertes: exigen estrategia confirmada o señales muy claras en diagnóstico. */
function passesStageGate(kind: PitchKind, strategyApproved: boolean, source: string, tabs: Record<string, string>): boolean {
  const pool = normForMatch(`${source}\n${tabs.OPORTUNIDADES ?? ""}\n${tabs.ACCIONES ?? ""}`);
  if (kind === "demand") {
    if (strategyApproved) return true;
    return (
      countThemeAnchors("demand", pool) >= 2 &&
      (pool.includes("pauta") || pool.includes("ads") || pool.includes("campana") || pool.includes("campa"))
    );
  }
  if (kind === "strategy") {
    if (strategyApproved) return true;
    return countThemeAnchors("strategy", pool) >= 2;
  }
  return true;
}

function kindToFamilyLabel(kind: PitchKind): string {
  switch (kind) {
    case "strategy":
      return "Estrategia y consultoría";
    case "demand":
      return "Pauta y captación";
    case "linkedin":
      return "LinkedIn / B2B";
    case "web":
      return "Web y conversión";
    case "seo":
      return "SEO y orgánico";
    case "content":
      return "Contenido y editorial";
    default:
      return "Servicio";
  }
}

function expectedDurationForSuggestion(s: EasyService): string {
  const b = billingKindFromEasyService(s);
  if (b === "monthly") return "Recurrente (mensual) durante el horizonte de la propuesta";
  if (b === "hourly") return "Bolsa de horas / demanda según acuerdo";
  if (b === "project") return "Proyecto acotado (fase de implementación)";
  return "Puntual o un solo mes en la grilla";
}

function buildStrategicJustification(
  kind: PitchKind,
  strategyApproved: boolean,
  service: EasyService,
  source: string,
  sourceWords: string[]
): string {
  if (strategyApproved) {
    return `Encaja con la estrategia comercial confirmada y con el catálogo en ${kindToFamilyLabel(kind).toLowerCase()}.`;
  }
  const ex = firstRelevantExcerpt(source, sourceWords, 120);
  if (ex) {
    return `El informe/diagnóstico menciona el tema; encaja con ${labelForService(service)} como variante concreta.`;
  }
  return `Coherente con las señales del informe en ${kindToFamilyLabel(kind).toLowerCase()} (validación por anclas de tema).`;
}

function buildStrategicDecision(
  kind: PitchKind,
  service: EasyService,
  strategyApproved: boolean,
  source: string,
  sourceWords: string[]
): StrategicDecision {
  const variantLabel = [service.codigo, service.nombre].filter(Boolean).join(" — ").trim() || service.nombre;
  return {
    familyLabel: kindToFamilyLabel(kind),
    variantLabel,
    strategicJustification: buildStrategicJustification(kind, strategyApproved, service, source, sourceWords),
    expectedDuration: expectedDurationForSuggestion(service),
  };
}

const MAX_STRATEGIC_SUGGESTIONS = 5;
const MIN_SCORE_WITH_STRATEGY = 32;
const MIN_SCORE_WITHOUT_STRATEGY = 44;

function countDistinctLexemeHits(poolNorm: string, words: string[]): number {
  let n = 0;
  for (const w of words) {
    if (poolNorm.includes(normText(w))) n += 1;
  }
  return n;
}

/** Evita que un solo término suelto en catálogo dispare la sugerencia. */
function serviceStrongCatalogMatch(s: EasyService, serviceWords: string[]): boolean {
  const fp = suggestedServiceFingerprint(s);
  const hits = serviceWords.filter((w) => fp.includes(normText(w)));
  if (hits.length >= 2) return true;
  if (hits.length === 1 && normText(hits[0]).length >= 7) return true;
  return false;
}

/**
 * El `kind` de la regla debe ser coherente con la familia detectada en catálogo
 * (salvo `singleton:*`, que se acepta por definición).
 */
function familyAcceptableForKind(kind: PitchKind, familyId: string): boolean {
  if (familyId.startsWith("singleton:")) return true;
  switch (kind) {
    case "strategy":
      return familyId === "fam_estrategia";
    case "demand":
      return familyId === "fam_pauta";
    case "linkedin":
      return familyId === "fam_linkedin";
    case "web":
      return familyId === "fam_web";
    case "seo":
      return familyId === "fam_seo";
    case "content":
      return familyId === "fam_contenido" || familyId === "fam_redes";
    default:
      return true;
  }
}

function scoreSuggestionCandidate(
  s: EasyService,
  kind: PitchKind,
  priority: Suggested["priority"],
  source: string,
  fullPool: string,
  poolNorm: string,
  strategyNorm: string,
  strategyApproved: boolean,
  sourceWords: string[],
  serviceWords: string[],
  tabs: Record<string, string>
): { score: number; evidence: string[] } {
  const evidence: string[] = [];
  let score = 0;

  const themeCount = countThemeAnchors(kind, fullPool);
  score += Math.min(26, themeCount * 9);
  if (themeCount >= 2) {
    evidence.push(`${themeCount} anclas de tema alineadas a ${kindToFamilyLabel(kind)}`);
  } else if (themeCount === 1) {
    evidence.push(`Tema ${kindToFamilyLabel(kind)} presente en informe / estrategia`);
  }

  if (strategyNorm.length > 12) {
    const st = countThemeAnchors(kind, strategyNorm);
    if (st >= 1) {
      score += Math.min(18, st * 9);
      evidence.push("Coincidencias explícitas en el texto de estrategia");
    }
  }

  const diagNorm = normText([tabs.OPORTUNIDADES, tabs.ACCIONES, tabs.diagnostico, tabs.DIAGNOSTICO].filter(Boolean).join("\n"));
  if (diagNorm.length > 8) {
    const d = countThemeAnchors(kind, diagNorm);
    if (d >= 1) {
      score += Math.min(14, d * 7);
      evidence.push("Diagnóstico u oportunidades refuerzan el mismo eje");
    }
  }

  const srcHits = countDistinctLexemeHits(poolNorm, sourceWords);
  score += Math.min(12, srcHits * 3);
  if (srcHits >= 2) evidence.push("Varias palabras de contexto respaldan la regla (no una sola)");

  const fp = suggestedServiceFingerprint(s);
  const svcHits = countDistinctLexemeHits(fp, serviceWords);
  score += Math.min(14, svcHits * 4);
  if (svcHits >= 2) evidence.push("El ítem de catálogo cumple varios criterios de encaje");

  if (firstRelevantExcerpt(source, sourceWords, 140)) {
    score += 12;
    evidence.push("Fragmento del informe ancla el tema con narrativa");
  }

  if (strategyApproved) {
    score += 10;
    evidence.push("Etapa: estrategia comercial confirmada");
  }

  if (priority === "alta") score += 5;
  else if (priority === "media") score += 2;

  // Riesgo de redundancia / ruido: una sola señal en cadena sin estrategia
  if (!strategyApproved && themeCount <= 1 && srcHits <= 1 && svcHits <= 1) {
    score -= 28;
    evidence.push("Penalización: pocas señales independientes sin estrategia confirmada");
  }

  return { score: Math.max(0, Math.round(score)), evidence };
}

const MAX_EVIDENCE_CHIPS = 3;
const EVIDENCE_CHIP_TEXT_MAX = 46;

function keywordsForEvidence(kind: PitchKind, sourceWords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of [...DIAGNOSTIC_ANCHORS[kind], ...sourceWords]) {
    const k = normText(w);
    if (k.length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

function chunkMatchesKeywords(chunkNorm: string, keywords: string[]): boolean {
  return keywords.some((kw) => chunkNorm.includes(normText(kw)));
}

/** Oración o línea real del texto que contiene tema o palabras de la regla. */
function excerptForKeywords(rawText: string, keywords: string[], maxContentLen: number): string | null {
  const t = rawText.trim();
  if (!t) return null;
  const parts = t
    .split(/[\n.!?]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 12);
  for (const part of parts) {
    if (!chunkMatchesKeywords(normText(part), keywords)) continue;
    const cleaned = part.replace(/^[-•*]\s*/, "").replace(/\s+/g, " ").trim();
    if (cleaned.length > maxContentLen) return cleaned.slice(0, maxContentLen - 1).trim() + "…";
    return cleaned;
  }
  return null;
}

function labeledChip(label: string, tabContent: string | undefined, keywords: string[], labelOverhead: number): string | null {
  if (!tabContent?.trim()) return null;
  const inner = excerptForKeywords(tabContent, keywords, EVIDENCE_CHIP_TEXT_MAX - labelOverhead);
  if (!inner) return null;
  return `${label}: ${inner}`;
}

/**
 * Chips concretos para UI: solo extractos del informe/estrategia/tabs o términos de catálogo que efectivamente matchearon.
 */
function buildEvidenceChips(
  kind: PitchKind,
  sourceWords: string[],
  serviceWords: string[],
  source: string,
  fromStrategy: string,
  tabs: Record<string, string>,
  service: EasyService
): string[] {
  const kws = keywordsForEvidence(kind, sourceWords);
  const chips: string[] = [];
  const push = (line: string | null | undefined) => {
    const t = line?.trim();
    if (!t) return;
    if (chips.some((c) => normText(c) === normText(t))) return;
    chips.push(t);
  };

  const strat = fromStrategy.trim();
  if (strat.length > 18) {
    const ex = excerptForKeywords(strat, kws, EVIDENCE_CHIP_TEXT_MAX - 12);
    if (ex) push(`Estrategia: ${ex}`);
  }

  const diagJoined = [tabs.diagnostico, tabs.DIAGNOSTICO].filter(Boolean).join("\n\n");
  push(labeledChip("Diagnóstico", diagJoined || undefined, kws, 14));

  push(labeledChip("Oportunidad", tabs.OPORTUNIDADES, kws, 14));

  const canalPool = [tabs.ACCIONES, tabs.plan_crecimiento].filter(Boolean).join("\n\n");
  push(labeledChip("Canal / acciones", canalPool || undefined, kws, 18));

  if (chips.length < MAX_EVIDENCE_CHIPS) {
    const absenceNeedles = ["sin ", "no hay", "falta ", "ausencia", "desactual", "sin campañ", "sin campana", "débil ", "debil "];
    const pool = [source, tabs.OPORTUNIDADES, tabs.ACCIONES].filter(Boolean).join("\n");
    const parts = pool
      .split(/[\n.!?]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 16);
    for (const part of parts) {
      const low = part.toLowerCase();
      if (!absenceNeedles.some((n) => low.includes(n))) continue;
      if (!chunkMatchesKeywords(normText(part), kws)) continue;
      const cleaned = part.replace(/^[-•*]\s*/, "").replace(/\s+/g, " ").trim();
      const cap = EVIDENCE_CHIP_TEXT_MAX - 8;
      push(`Brecha / activo: ${cleaned.length > cap ? cleaned.slice(0, cap - 1).trim() + "…" : cleaned}`);
      break;
    }
  }

  if (chips.length < MAX_EVIDENCE_CHIPS) {
    const fe = firstRelevantExcerpt(source, sourceWords, EVIDENCE_CHIP_TEXT_MAX);
    if (fe) {
      const body = fe.length > EVIDENCE_CHIP_TEXT_MAX - 10 ? fe.slice(0, EVIDENCE_CHIP_TEXT_MAX - 11).trim() + "…" : fe;
      push(`Informe: ${body}`);
    }
  }

  if (chips.length < MAX_EVIDENCE_CHIPS) {
    const fp = suggestedServiceFingerprint(service);
    const hits = serviceWords.filter((w) => fp.includes(normText(w)));
    if (hits.length >= 1) {
      push(`Catálogo: «${hits.slice(0, 3).join("», «")}»`);
    }
  }

  return chips.slice(0, MAX_EVIDENCE_CHIPS);
}

type SuggestionRule = {
  kind: PitchKind;
  priority: Suggested["priority"];
  sourceWords: string[];
  serviceWords: string[];
};

const STRATEGIC_SUGGESTION_RULES: SuggestionRule[] = [
  {
    kind: "strategy",
    priority: "alta",
    sourceWords: ["estrategia", "prioridades", "hoja de ruta", "diagnostico", "diagnóstico", "plan comercial", "foco"],
    serviceWords: ["consultoria", "consultoría", "estrategia", "growth", "diagnostico", "diagnóstico", "auditoria", "auditoría"],
  },
  {
    kind: "demand",
    priority: "media",
    sourceWords: ["captación", "ads", "pauta", "tráfico", "campaña", "campañas", "performance", "inversión", "inversion", "meta", "google"],
    serviceWords: ["pauta", "ads", "google", "meta", "captacion", "captación", "paid", "media"],
  },
  {
    kind: "linkedin",
    priority: "media",
    sourceWords: ["linkedin", "autoridad", "social selling", "b2b", "ejecutiv"],
    serviceWords: ["linkedin", "social selling", "b2b", "sales navigator"],
  },
  {
    kind: "web",
    priority: "media",
    sourceWords: ["web", "landing", "conversión", "conversion", "sitio", "ux", "experiencia"],
    serviceWords: ["web", "landing", "sitio", "pagina", "página", "wordpress", "shopify", "ecommerce"],
  },
  {
    kind: "seo",
    priority: "media",
    sourceWords: ["seo", "orgánico", "organico", "buscador", "buscadores", "posicionamiento", "sem"],
    serviceWords: ["seo", "posicionamiento", "organico", "orgánico", "buscador", "serp"],
  },
  {
    kind: "content",
    priority: "media",
    sourceWords: ["contenido", "blog", "editorial", "copy", "newsletter", "articulo", "artículo"],
    serviceWords: ["contenido", "editorial", "copywriting", "blog", "newsletter", "copy"],
  },
];

function buildRankedStrategicSuggestions(
  catalog: EasyService[],
  rows: LeadServiceProposal[],
  aiReport: string | null | undefined,
  strategyContextText: string | undefined,
  strategyApproved: boolean,
  planHorizon: number
): Suggested[] {
  const used = new Set(
    rows.flatMap((r) => [r.service_id, r.agency_service_id].filter((x): x is string => Boolean(x && String(x).trim())))
  );
  const tabs = parseTabs(String(aiReport ?? ""));
  const fromStrategy = String(strategyContextText ?? "").trim();
  const fromReport = [tabs.ACCIONES, tabs.plan_crecimiento, tabs.OPORTUNIDADES, tabs.propuesta_easy].filter(Boolean).join("\n\n");
  const source = fromStrategy.length > 0 ? fromStrategy : fromReport;
  if (!source.trim()) return [];

  const diagPool = [tabs.OPORTUNIDADES, tabs.ACCIONES, tabs.plan_crecimiento, tabs.diagnostico, tabs.DIAGNOSTICO]
    .filter(Boolean)
    .join("\n\n");
  const fullPool = `${source}\n${fromStrategy}\n${diagPool}`;
  const poolNorm = normText(fullPool);
  const strategyNorm = normText(fromStrategy);
  const sourceNorm = normText(source);

  const minScore = strategyApproved ? MIN_SCORE_WITH_STRATEGY : MIN_SCORE_WITHOUT_STRATEGY;
  const minSourceHits = strategyApproved ? 1 : 2;
  const signals = detectVariantSignals(poolNorm);

  const raw: RawSuggestion[] = [];

  for (const rule of STRATEGIC_SUGGESTION_RULES) {
    if (!passesStrategicValidation(rule.kind, source, strategyApproved, fromStrategy, tabs)) continue;
    if (!passesStageGate(rule.kind, strategyApproved, source, tabs)) continue;

    const srcHits = countDistinctLexemeHits(sourceNorm, rule.sourceWords);
    if (srcHits < minSourceHits) continue;

    for (const s of catalog) {
      if (used.has(s.id)) continue;
      if (!serviceStrongCatalogMatch(s, rule.serviceWords)) continue;

      const family = exclusiveFamilyId(s);
      if (!familyAcceptableForKind(rule.kind, family)) continue;

      const { score, evidence } = scoreSuggestionCandidate(
        s,
        rule.kind,
        rule.priority,
        source,
        fullPool,
        poolNorm,
        strategyNorm,
        strategyApproved,
        rule.sourceWords,
        rule.serviceWords,
        tabs
      );
      if (score < minScore) continue;

      raw.push({
        service: s,
        kind: rule.kind,
        priority: rule.priority,
        score,
        evidence,
        family,
        sourceWords: rule.sourceWords,
        serviceWords: rule.serviceWords,
      });
    }
  }

  raw.sort((a, b) => b.score - a.score);

  const bestByService = new Map<string, RawSuggestion>();
  for (const c of raw) {
    const prev = bestByService.get(c.service.id);
    if (!prev || c.score > prev.score) bestByService.set(c.service.id, c);
  }
  const deduped = [...bestByService.values()].sort((a, b) => b.score - a.score);

  const byFamily = new Map<string, RawSuggestion[]>();
  for (const c of deduped) {
    if (!byFamily.has(c.family)) byFamily.set(c.family, []);
    byFamily.get(c.family)!.push(c);
  }

  const winners: Array<{
    raw: RawSuggestion;
    familyDecisionReason: string;
    variantDecisionReason: string;
  }> = [];
  for (const [, group] of byFamily) {
    const fam = group[0]?.family;
    if (!fam) continue;
    const choice = chooseVariantForFamily(fam, group, poolNorm, signals, strategyApproved);
    if (choice) winners.push({ raw: choice.winner, familyDecisionReason: choice.familyDecisionReason, variantDecisionReason: choice.variantDecisionReason });
  }
  winners.sort((a, b) => b.raw.score - a.raw.score);
  const picked = winners.slice(0, MAX_STRATEGIC_SUGGESTIONS);

  const pickedOrdered = [...picked].sort((a, b) => {
    const ra = structuralSuggestionRank(a.raw.family, a.raw.kind);
    const rb = structuralSuggestionRank(b.raw.family, b.raw.kind);
    if (ra !== rb) return ra - rb;
    return b.raw.score - a.raw.score;
  });

  const timingById = buildPlanTimingsForSuggestions(pickedOrdered, signals, strategyApproved, planHorizon);

  return pickedOrdered.map(({ raw: c, familyDecisionReason, variantDecisionReason }) => {
    const pitch = buildCommercialPitch(c.service, c.kind, source, c.sourceWords);
    const decision = buildStrategicDecision(c.kind, c.service, strategyApproved, source, c.sourceWords);
    const evidenceChips = buildEvidenceChips(
      c.kind,
      c.sourceWords,
      c.serviceWords,
      source,
      fromStrategy,
      tabs,
      c.service
    );
    const timing = timingById.get(c.service.id) ?? {
      startMonth: 1,
      durationMonths: Math.min(3, Math.max(1, Math.round(planHorizon))),
      timingReason: "Sugerencia por defecto: revisá mes y duración al agregar a la grilla.",
    };
    return {
      service: c.service,
      family: c.family,
      score: c.score,
      evidence: c.evidence,
      evidenceChips,
      strategicJustification: decision.strategicJustification,
      impact: pitch.impact,
      priority: c.priority,
      pitch,
      decision,
      familyDecisionReason,
      variantDecisionReason,
      suggestedStartMonth: timing.startMonth,
      suggestedDurationMonths: timing.durationMonths,
      timingReason: timing.timingReason,
    };
  });
}

function serviceFingerprint(s: EasyService): string {
  return [s.codigo, s.nombre, s.categoria, s.descripcion_corta, s.alcance_base].filter(Boolean).join(" ").toLowerCase();
}

/** Primer fragmento del texto fuente que menciona alguna palabra clave (para anclar el diagnóstico al lead). */
function firstRelevantExcerpt(source: string, keywords: string[], maxChars: number): string | null {
  const chunks = source
    .split(/[\n.!?]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 12);
  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) {
      const cleaned = chunk.replace(/^[-•*]\s*/, "").replace(/\s+/g, " ").trim();
      if (cleaned.length > maxChars) return cleaned.slice(0, maxChars - 1).trim() + "…";
      return cleaned;
    }
  }
  return null;
}

function sentenceCase(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function labelForService(s: EasyService): string {
  const x = [s.codigo, s.nombre].filter(Boolean).join(" — ").trim();
  return x || "Este servicio";
}

/** Fallback por familia de servicio (palabras en catálogo), antes de plantillas por `kind`. */
function pitchByServiceKeywords(service: EasyService, kind: PitchKind): CommercialPitch | null {
  const t = serviceFingerprint(service);
  const L = labelForService(service);

  if (t.includes("crm") || t.includes("hubspot") || t.includes("pipeline") || t.includes("ventas")) {
    return {
      diagnosis: `El seguimiento comercial no está estandarizado: oportunidades se pierden entre consultas y cierre.`,
      problem: `Sin etapas claras y datos centralizados, el equipo no prioriza ni replica lo que funciona.`,
      impact: `${L} ordena el embudo, mejora la tasa de conversión y da visibilidad a la gestión.`,
    };
  }
  if (t.includes("email") || t.includes("mailing") || t.includes("newsletter")) {
    return {
      diagnosis: `La comunicación con leads y clientes depende de envíos puntuales sin nutrición sistemática.`,
      problem: `Eso deja valor sobre la mesa: menos reactivación, menos recurrencia y mensajes inconsistentes.`,
      impact: `${L} permite secuencias medibles, personalización y más conversiones desde la base propia.`,
    };
  }
  if (t.includes("analític") || t.includes("analytics") || t.includes("medición") || t.includes("datos")) {
    return {
      diagnosis: `Las decisiones de marketing y ventas se toman con información parcial o desactualizada.`,
      problem: `Invertir sin saber qué canal o mensaje aporta consultas encarece el costo de adquisición.`,
      impact: `${L} deja tableros y eventos claros para optimizar inversión y el discurso comercial.`,
    };
  }
  if (t.includes("brand") || t.includes("marca") || t.includes("identidad")) {
    return {
      diagnosis: `La propuesta de valor no se percibe homogénea en puntos de contacto digitales y comerciales.`,
      problem: `Esa dispersión debilita confianza y hace más difícil justificar precio frente a competidores.`,
      impact: `${L} alinea mensaje y estética para que cada interacción refuerce reconocimiento y cierre.`,
    };
  }
  if (kind === "seo" || t.includes("seo") || t.includes("posicionamiento") || t.includes("orgánico")) {
    return {
      diagnosis: `La empresa compite en búsquedas sin una base técnica y de contenidos alineada a intención de compra.`,
      problem: `Depender solo de tráfico espontáneo retrasa consultas cualificadas y deja huecos frente a competencia.`,
      impact: `${L} mejora visibilidad sostenida y atrae demanda con intención, complementando pauta y otros canales.`,
    };
  }
  if (kind === "content" || t.includes("contenido") || t.includes("copy") || t.includes("blog")) {
    return {
      diagnosis: `El discurso comercial no se traduce en piezas que eduquen y muevan al lead en cada etapa.`,
      problem: `Sin contenidos consistentes, el sitio y las redes no generan confianza ni motivos para avanzar.`,
      impact: `${L} alinea narrativa y formatos para acortar ciclos y dar argumentos al equipo comercial.`,
    };
  }
  return null;
}

function fallbackPitchByKind(service: EasyService, kind: PitchKind): CommercialPitch {
  const byKw = pitchByServiceKeywords(service, kind);
  if (byKw) return byKw;
  const L = labelForService(service);

  switch (kind) {
    case "strategy":
      return {
        diagnosis: `Las prioridades comerciales y de crecimiento no están ordenadas en un plan accionable por trimestre.`,
        problem: `Sin foco compartido, el presupuesto se fragmenta y es difícil medir qué impulsa ingresos.`,
        impact: `${L} traduce diagnóstico en decisiones, secuencia de iniciativas y métricas de seguimiento.`,
      };
    case "demand":
      return {
        diagnosis: `Detectamos que la generación de demanda no tiene un canal de pago estructurado y medido.`,
        problem: `Depender solo de tráfico orgánico o referidos limita consultas en el corto plazo y oscila el pipeline.`,
        impact: `${L} acelera llegada a audiencias calificadas y permite optimizar inversión según resultados.`,
      };
    case "linkedin":
      return {
        diagnosis: `La autoridad del equipo y de la marca en entornos B2B no se traduce en conversaciones comerciales.`,
        problem: `Sin presencia profesional activa, se pierden oportunidades de confianza y contactos calientes.`,
        impact: `${L} fortalece posicionamiento, social selling y flujo de conversaciones hacia reuniones.`,
      };
    case "web":
      return {
        diagnosis: `El sitio o las landings no cierran la promesa comercial: hay fricción o mensajes poco alineados.`,
        problem: `Eso encarece cada consulta: el tráfico llega pero no convierte al ritmo que el negocio necesita.`,
        impact: `${L} mejora claridad, pruebas y llamados a la acción para elevar tasa de conversión.`,
      };
    case "content":
      return {
        diagnosis: `Falta un hilo conductor de mensajes que acompañe al comprador desde descubrimiento a decisión.`,
        problem: `Piezas aisladas no refuerzan la propuesta de valor ni dan al comercial argumentos repetibles.`,
        impact: `${L} estructura contenidos por etapa y canal para educar, diferenciar y acelerar cierres.`,
      };
    case "seo":
      return {
        diagnosis: `La captación orgánica no está explotada: búsquedas relevantes no devuelven la marca de forma competitiva.`,
        problem: `Eso deja la mesa servida a competidores y aumenta la dependencia de canales más caros.`,
        impact: `${L} mejora visibilidad durable y calidad de visitas con intención de compra o consulta.`,
      };
    default:
      return {
        diagnosis: `Hay brechas entre lo que el mercado espera y cómo la oferta se presenta y se entrega hoy.`,
        problem: `Sin cerrar esas brechas, el costo de vender sube y el crecimiento depende de esfuerzos puntuales.`,
        impact: `${L} ataja esas brechas con un alcance acotado y medible alineado al catálogo.`,
      };
  }
}

function buildCommercialPitch(
  service: EasyService,
  kind: PitchKind,
  source: string,
  matchKeywords: string[]
): CommercialPitch {
  const excerpt = firstRelevantExcerpt(source, matchKeywords, 170);
  const base = fallbackPitchByKind(service, kind);
  if (!excerpt) return base;
  const line = sentenceCase(excerpt);
  const diagnosis = line.endsWith(".") || line.endsWith("?") || line.endsWith("!") ? line : `${line}.`;
  return {
    diagnosis,
    problem: base.problem,
    impact: base.impact,
  };
}

type Props = {
  leadId: string;
  aiReport?: string | null;
  /** Sin esto no se puede confirmar estructura ni priorizar sugerencias solo con informe. */
  strategyApproved?: boolean;
  /** Contenido de estrategia (aprobada o borrador) para matchear servicios. */
  strategyContextText?: string;
  proposalConfirmedAt?: string | null;
  onStructureConfirmed?: () => void;
  onConfirmReadinessChange?: (ready: boolean, busy: boolean) => void;
};

function getCols(n: number) {
  const safe = Math.max(1, Math.min(24, n));
  return Array.from({ length: safe }).map((_, i) => ({ key: `m_${i + 1}`, label: `Mes ${i + 1}` }));
}

function parseTabs(report: string): Record<string, string> {
  const out: Record<string, string> = {};
  const rx = /###\s+TAB:\s*(\w+)\s*\n/gi;
  const hits: Array<{ id: string; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(report)) !== null) hits.push({ id: m[1], start: m.index + m[0].length });
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].start;
    const rest = report.slice(start);
    const next = rest.match(/###\s+TAB:\s*\w+\s*\n/i);
    const end = next && typeof next.index === "number" ? start + next.index : report.length;
    const content = report.slice(start, end).trim();
    if (content) out[hits[i].id] = content;
  }
  return out;
}

function normText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function suggestedServiceFingerprint(s: EasyService): string {
  return normText([s.codigo, s.nombre, s.categoria, s.descripcion_corta, s.alcance_base].filter(Boolean).join(" "));
}

/**
 * Familias mutuamente excluyentes: solo una sugerencia por familia (mejor prioridad; empate → primera en el pipeline).
 * Orden de evaluación: más específico primero (pauta vs orgánico, linkedin vs redes genéricas).
 */
function exclusiveFamilyId(s: EasyService): string {
  const t = suggestedServiceFingerprint(s);

  const pauta =
    /\b(starter|crecimiento|escala|performance\s+media|paid\s*media|inversion\s+en\s+pauta|inversion\s+publicitaria)\b/.test(t) ||
    /\b(pauta\s+digital|media\s+buying|google\s*ads|facebook\s*ads|meta\s*ads|tiktok\s*ads|linkedin\s*ads|youtube\s*ads)\b/.test(t) ||
    (/\bads\b/.test(t) && !/\borgani(c|co)\b/.test(t) && !/\bseo\b/.test(t));
  if (pauta) return "fam_pauta";

  const linkedin =
    t.includes("linkedin") || t.includes("social selling") || (t.includes("b2b") && t.includes("linkedin"));
  if (linkedin) return "fam_linkedin";

  const redes =
    /\b(redes\s+sociales?|community\s+manager|instagram|tiktok)\b/.test(t) ||
    (t.includes("facebook") && !t.includes("ads")) ||
    (/\b(4|8|12)\b/.test(t) &&
      /\b(piezas?|posts?|publicaciones?|contenidos?)\b/.test(t) &&
      !t.includes("blog") &&
      !t.includes("articulo"));
  if (redes) return "fam_redes";

  const web =
    /\b(web|sitio(\s+web)?|landing|e-?commerce|ecommerce|tienda\s+online|shopify|wordpress|redisen(o|no)|rediseno|desde\s+cero|mejora\s+puntual|actualizacion\s+web)\b/.test(t) ||
    /\b(diseno|diseño)\s+web\b/.test(t);
  if (web) return "fam_web";

  const seo =
    t.includes("seo") ||
    (t.includes("posicionamiento") && (t.includes("organico") || t.includes("buscador") || t.includes("google") && !t.includes("ads")));
  if (seo) return "fam_seo";

  const contenido =
    /\b(blog|editorial|newsletter|copywriting|copy\s+para|articulos?|artículos?)\b/.test(t) ||
    (t.includes("contenido") && !t.includes("linkedin"));
  if (contenido) return "fam_contenido";

  const estrategia =
    /\b(estrategia|consultoria|diagnostico(\s+comercial)?|growth|hoja\s+de\s+ruta|plan\s+comercial|auditoria\s+comercial)\b/.test(t);
  if (estrategia) return "fam_estrategia";

  return `singleton:${s.id}`;
}

/** Señales del informe/estrategia para elegir tier dentro de familias excluyentes. */
type VariantSignals = {
  intensityMin: boolean;
  intensityMed: boolean;
  intensityHigh: boolean;
  webBroken: boolean;
  webWeak: boolean;
  webMissing: boolean;
  commerceNeed: boolean;
  budgetCautious: boolean;
  scaleAggressive: boolean;
};

function detectVariantSignals(poolNorm: string): VariantSignals {
  return {
    intensityMin:
      /\b(presencia\s+minima|minima\s+presencia|empezar|piloto|pilot|basico|basica|arrancar|arranque)\b/.test(poolNorm) ||
      /\b(4\s*piezas?|cuatro\s*piezas?)\b/.test(poolNorm),
    intensityMed:
      /\b(consistenc|mantener|ritmo|sosten|plan\s+mensual|calendario\s+editorial)\b/.test(poolNorm) ||
      /\b(8\s*piezas?|ocho\s*piezas?)\b/.test(poolNorm),
    intensityHigh:
      /\b(intensiv|volumen|alta\s+frecuencia|12\s*piezas?|doce\s*piezas?|muchas\s+publicaciones)\b/.test(poolNorm),
    webBroken:
      /\b(roto|caido|no\s+carga|obsolet|desfasad|estructural|insegur[oa]|hackead)\b/.test(poolNorm),
    webWeak:
      /\b(desactualiz|lent[ao]|confus[oa]|friccion|ux\s+mala|poco\s+clar[oa]|mejora\s+web)\b/.test(poolNorm),
    webMissing:
      /\b(sin\s+web|no\s+hay\s+sitio|sin\s+sitio|desde\s+cero|sitio\s+nuevo|nuevo\s+sitio|no\s+exist\w+\s+web)\b/.test(
        poolNorm
      ),
    commerceNeed:
      /\b(e-?commerce|ecommerce|tienda\s+online|catalogo|catálogo|carrito|checkout|shopify|venta\s+online|transacc)\b/.test(
        poolNorm
      ),
    budgetCautious:
      /\b(starter|probar|prueba|piloto|presupuesto\s+ajustado|presupuesto\s+limitado|inversion\s+baja)\b/.test(poolNorm),
    scaleAggressive:
      /\b(escala|escalar\s+inversion|crecimiento\s+agresiv|inversion\s+fuerte|rango\s+alto|performance\s+maxim)\b/.test(
        poolNorm
      ),
  };
}

function redesPackSize(s: EasyService): 4 | 8 | 12 | null {
  const t = suggestedServiceFingerprint(s);
  const m = t.match(/\b(4|8|12)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n === 4 || n === 8 || n === 12) return n;
  return null;
}

type WebServiceTier = "ecommerce" | "nuevo" | "rediseno" | "mejora" | "landing" | "otro";

function classifyWebServiceTier(s: EasyService): WebServiceTier {
  const t = suggestedServiceFingerprint(s);
  if (/\b(e-?commerce|ecommerce|tienda\s+online|shopify|woocommerce|prestashop|venta\s+online)\b/.test(t)) return "ecommerce";
  if (/\b(desde\s+cero|sitio\s+nuevo|nuevo\s+sitio|web\s+nueva|crear\s+web)\b/.test(t)) return "nuevo";
  if (/\b(redisen|rediseno|renovacion|renovación|refonte)\b/.test(t)) return "rediseno";
  if (/\blanding\b/.test(t) && !/\bsitio(\s+web)?\b/.test(t)) return "landing";
  if (/\b(mejora|actualizacion|actualización|optimizacion|optimización|puntual)\b/.test(t)) return "mejora";
  if (/\b(web|sitio)\b/.test(t)) return "mejora";
  return "otro";
}

const WEB_TIER_ORDER: WebServiceTier[] = ["landing", "mejora", "rediseno", "nuevo", "ecommerce"];

function webTierIndex(tier: WebServiceTier): number {
  const i = WEB_TIER_ORDER.indexOf(tier);
  return i >= 0 ? i : WEB_TIER_ORDER.indexOf("mejora");
}

/**
 * Objetivo de variante web según informe/estrategia:
 * - transaccional → ecommerce
 * - sin web o inviable → sitio nuevo (salvo texto pida rediseño)
 * - fallas estructurales / muy débil → rediseño
 * - fallas puntuales / UX → mejora
 */
function desiredWebVariantGoal(signals: VariantSignals, poolNorm: string): WebServiceTier {
  if (signals.commerceNeed) return "ecommerce";
  if (signals.webMissing) {
    if (/\b(redisen|rediseno|rediseñ|renovacion|renovación)\b/.test(poolNorm)) return "rediseno";
    return "nuevo";
  }
  if (signals.webBroken) return "rediseno";
  if (signals.webWeak) return "mejora";
  return "mejora";
}

type PautaTier = "starter" | "crecimiento" | "escala" | "otro";

function classifyPautaServiceTier(s: EasyService): PautaTier {
  const t = suggestedServiceFingerprint(s);
  if (/\bstarter\b/.test(t)) return "starter";
  if (/\b(escala|scaling)\b/.test(t)) return "escala";
  if (/\bcrecimient/.test(t)) return "crecimiento";
  return "otro";
}

/** Solo dos buckets comerciales: starter vs crecimiento (escala de catálogo se alinea a crecimiento). */
function desiredPautaBucket(signals: VariantSignals): "starter" | "crecimiento" {
  if (signals.budgetCautious || signals.intensityMin) return "starter";
  return "crecimiento";
}

type RawSuggestion = {
  service: EasyService;
  kind: PitchKind;
  priority: Suggested["priority"];
  score: number;
  evidence: string[];
  family: string;
  sourceWords: string[];
  serviceWords: string[];
};

type FamilyVariantChoice = {
  winner: RawSuggestion;
  familyDecisionReason: string;
  variantDecisionReason: string;
};

function chooseRedesVariant(
  candidates: RawSuggestion[],
  signals: VariantSignals,
  strategyApproved: boolean
): FamilyVariantChoice {
  let target: 4 | 8 | 12;
  let familyDecisionReason: string;
  if (signals.intensityHigh) {
    target = 12;
    familyDecisionReason =
      "Familia redes: intensidad, volumen o marca muy activa en el informe → prioridad a 12 piezas.";
  } else if (signals.intensityMed) {
    target = 8;
    familyDecisionReason =
      "Familia redes: consistencia, ritmo o plan mensual explícito → prioridad a 8 piezas.";
  } else if (signals.intensityMin) {
    target = 4;
    familyDecisionReason =
      "Familia redes: presencia mínima, arranque o volumen básico → prioridad a 4 piezas.";
  } else if (strategyApproved) {
    target = 8;
    familyDecisionReason =
      "Familia redes: estrategia confirmada sin señal fuerte de volumen → default 8 piezas (equilibrio).";
  } else {
    target = 8;
    familyDecisionReason =
      "Familia redes: sin señales claras de intensidad → default intermedio 8 piezas.";
  }

  const scored = candidates.map((c) => {
    const size = redesPackSize(c.service);
    let fit = 0;
    if (size === target) fit = 44;
    else if (size != null && Math.abs(size - target) === 4) fit = 14;
    else if (size != null) fit = -28;
    return { c, total: c.score + fit, size };
  });
  scored.sort((a, b) => b.total - a.total || b.c.score - a.c.score);
  const best = scored[0];
  const variantDecisionReason =
    best.size != null
      ? `Elegido pack ${best.size} piezas (objetivo ${target}): encaje de alcance vs score base ${best.c.score}.`
      : `Sin 4/8/12 explícito en catálogo: gana el mayor score (${best.c.score}) entre candidatas.`;
  return { winner: best.c, familyDecisionReason, variantDecisionReason };
}

function chooseWebVariant(
  candidates: RawSuggestion[],
  signals: VariantSignals,
  poolNorm: string
): FamilyVariantChoice {
  const want = desiredWebVariantGoal(signals, poolNorm);
  let familyDecisionReason: string;
  if (signals.commerceNeed) {
    familyDecisionReason = "Familia web: necesidad transaccional, catálogo o compra online → ecommerce.";
  } else if (signals.webMissing) {
    familyDecisionReason =
      "Familia web: ausencia de sitio o inviabilidad de lo actual → sitio desde cero o rediseño según texto.";
  } else if (signals.webBroken) {
    familyDecisionReason =
      "Familia web: problema estructural o sitio muy débil → rediseño (básico/profundo) frente a mejora puntual.";
  } else if (signals.webWeak) {
    familyDecisionReason = "Familia web: sitio existente con fallas puntuales o UX → mejora puntual u optimización.";
  } else {
    familyDecisionReason = "Familia web: sin señal fuerte; se favorece mejora incremental alineada al catálogo.";
  }

  const scored = candidates.map((c) => {
    const tier = classifyWebServiceTier(c.service);
    const got: WebServiceTier = tier === "otro" ? "mejora" : tier;
    const di = Math.abs(webTierIndex(got) - webTierIndex(want));
    let fit = 0;
    if (di === 0) fit = 42;
    else if (di === 1) fit = 16;
    else fit = -Math.min(38, 14 + di * 9);
    return { c, total: c.score + fit, got };
  });
  scored.sort((a, b) => b.total - a.total || b.c.score - a.c.score);
  const best = scored[0];
  const variantDecisionReason = `Variante «${best.got}» vs objetivo «${want}»; total ${best.total} (score base ${best.c.score}).`;
  return { winner: best.c, familyDecisionReason, variantDecisionReason };
}

function choosePautaVariant(
  candidates: RawSuggestion[],
  signals: VariantSignals,
  strategyApproved: boolean
): FamilyVariantChoice {
  const want = desiredPautaBucket(signals);
  const familyDecisionReason =
    want === "starter"
      ? "Familia pauta: validación inicial, activación simple o presupuesto prudente → starter."
      : signals.scaleAggressive || signals.intensityHigh
        ? "Familia pauta: tracción previa o intención de escalar inversión → crecimiento (u oferta escala del catálogo)."
        : strategyApproved
          ? "Familia pauta: estrategia confirmada → nivel crecimiento por defecto."
          : "Familia pauta: sin señales de solo validación → crecimiento por defecto.";

  const scored = candidates.map((c) => {
    const st = classifyPautaServiceTier(c.service);
    let fit = 0;
    if (want === "starter") {
      if (st === "starter") fit = 44;
      else if (st === "crecimiento") fit = -16;
      else if (st === "escala") fit = -30;
    } else {
      if (st === "crecimiento") fit = 42;
      else if (st === "escala") fit = signals.scaleAggressive || signals.intensityHigh ? 40 : 30;
      else if (st === "starter") fit = -16;
    }
    return { c, total: c.score + fit, st };
  });
  scored.sort((a, b) => b.total - a.total || b.c.score - a.c.score);
  const best = scored[0];
  const variantDecisionReason =
    best.st === "otro"
      ? `Catálogo sin etiqueta starter/crecimiento clara: gana score ajustado ${best.total} (base ${best.c.score}).`
      : `Oferta tipo «${best.st}» alineada al objetivo «${want}»; total ${best.total} (base ${best.c.score}).`;
  return { winner: best.c, familyDecisionReason, variantDecisionReason };
}

/**
 * Una sola variante por familia: combina score estratégico, señales del informe, etapa y alcance del ítem de catálogo.
 */
function chooseVariantForFamily(
  family: string,
  candidates: RawSuggestion[],
  poolNorm: string,
  signals: VariantSignals,
  strategyApproved: boolean
): FamilyVariantChoice | null {
  if (candidates.length === 0) return null;
  if (family === "fam_redes") return chooseRedesVariant(candidates, signals, strategyApproved);
  if (family === "fam_web") return chooseWebVariant(candidates, signals, poolNorm);
  if (family === "fam_pauta") return choosePautaVariant(candidates, signals, strategyApproved);

  if (candidates.length === 1) {
    const w = candidates[0];
    return {
      winner: w,
      familyDecisionReason: `Única candidata en ${family} (sin competencia de variantes).`,
      variantDecisionReason: `Score estratégico ${w.score}; esta familía no tiene reglas de variante en LEADS87.`,
    };
  }
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const w = sorted[0];
  return {
    winner: w,
    familyDecisionReason: `Familia ${family} sin reglas de variante LEADS87: gana el mayor score estratégico.`,
    variantDecisionReason: `Elegido score ${w.score} entre ${candidates.length} candidatas.`,
  };
}

type SuggestedTimingContext = {
  family: string;
  kind: PitchKind;
  service: EasyService;
};

function clampSuggestedTiming(
  startMonth: number,
  durationMonths: number,
  planHorizon: number,
  timingReason: string
): { startMonth: number; durationMonths: number; timingReason: string } {
  const horizon = Math.min(24, Math.max(1, Math.round(planHorizon)));
  const sm = Math.min(24, Math.max(1, Math.round(startMonth)));
  let dm = Math.max(1, Math.round(durationMonths));
  if (sm + dm - 1 > horizon) {
    dm = Math.max(1, horizon - sm + 1);
    return { startMonth: sm, durationMonths: dm, timingReason: `${timingReason} Recortado al horizonte (${horizon} meses).` };
  }
  return { startMonth: sm, durationMonths: dm, timingReason };
}

function isRecurringServiceFamily(family: string): boolean {
  return (
    family === "fam_redes" ||
    family === "fam_pauta" ||
    family === "fam_seo" ||
    family === "fam_contenido" ||
    family === "fam_linkedin"
  );
}

function isExploratoryTiming(signals: VariantSignals): boolean {
  return signals.budgetCautious || signals.intensityMin;
}

function isStrongTimingContext(signals: VariantSignals): boolean {
  return signals.scaleAggressive || signals.intensityHigh || signals.commerceNeed;
}

/**
 * Mes de inicio y meses activos sugeridos para una sugerencia (no altera borrador, overrides ni confirmación).
 */
function suggestTimingForService(
  ctx: SuggestedTimingContext,
  signals: VariantSignals,
  strategyApproved: boolean,
  planHorizon: number,
  dependencyMinStart: number = 1
): { startMonth: number; durationMonths: number; timingReason: string } {
  const horizon = Math.min(24, Math.max(1, Math.round(planHorizon)));
  const fp = suggestedServiceFingerprint(ctx.service);
  const webTier = classifyWebServiceTier(ctx.service);
  const minStart = Math.min(24, Math.max(1, Math.round(dependencyMinStart)));

  if (ctx.family === "fam_estrategia" || ctx.kind === "strategy") {
    return clampSuggestedTiming(
      1,
      strategyApproved ? 2 : 3,
      horizon,
      "Estrategia/consultoría al inicio del plan (2–3 meses) para fijar prioridades antes del resto."
    );
  }

  if (ctx.family === "fam_web") {
    const heavy = webTier === "nuevo" || webTier === "ecommerce" || webTier === "rediseno";
    const dur = heavy ? 3 : webTier === "mejora" ? 2 : 1;
    return clampSuggestedTiming(
      1,
      dur,
      horizon,
      heavy
        ? "Web base (nuevo sitio, ecommerce o rediseño): 2–3 meses al inicio; suele preceder a pauta fuerte."
        : "Mejora puntual o landing: 1–2 meses al inicio."
    );
  }

  if (isRecurringServiceFamily(ctx.family)) {
    let dur: number;
    let reason: string;
    if (isExploratoryTiming(signals)) {
      dur = 3;
      reason = "Recurrente en modo exploratorio: 3 meses mínimos sugeridos.";
    } else if (strategyApproved || isStrongTimingContext(signals)) {
      dur = Math.min(6, horizon);
      reason = "Estrategia u oportunidad fuerte: 6 meses de actividad (o hasta el horizonte).";
    } else {
      dur = Math.min(4, horizon);
      reason = "Recurrente: 4 meses como referencia base.";
    }
    const start = ctx.family === "fam_redes" ? 1 : Math.max(1, minStart);
    if (ctx.family === "fam_redes") {
      reason += " Redes puede arrancar en mes 1 incluso con web en curso (intensidad acotada al inicio).";
    }
    return clampSuggestedTiming(start, dur, horizon, reason);
  }

  if (ctx.family.startsWith("singleton:")) {
    if (/\b(automatiz|implementacion|implementación|hubspot|crm|pipeline|integracion|integración)\b/.test(fp)) {
      return clampSuggestedTiming(
        Math.max(1, minStart),
        Math.min(2, horizon),
        horizon,
        "Setup/automatización: 1–2 meses, habitualmente tras estrategia o base de datos."
      );
    }
    if (/\b(brand|marca|identidad)\b/.test(fp)) {
      return clampSuggestedTiming(
        Math.max(1, minStart),
        Math.min(2, horizon),
        horizon,
        "Branding: bloque corto al inicio o tras alinear estrategia."
      );
    }
  }

  return clampSuggestedTiming(
    Math.max(1, minStart),
    Math.min(2, horizon),
    horizon,
    "Servicio puntual: 1–2 meses activos sugeridos."
  );
}

function structuralSuggestionRank(family: string, kind: PitchKind): number {
  if (family === "fam_estrategia" || kind === "strategy") return 0;
  if (family === "fam_web") return 1;
  if (family === "fam_redes") return 2;
  if (family === "fam_seo") return 3;
  if (family === "fam_contenido") return 4;
  if (family === "fam_linkedin") return 5;
  if (family === "fam_pauta" || kind === "demand") return 6;
  return 7;
}

function buildPlanTimingsForSuggestions(
  picked: Array<{ raw: RawSuggestion }>,
  signals: VariantSignals,
  strategyApproved: boolean,
  planHorizon: number
): Map<string, { startMonth: number; durationMonths: number; timingReason: string }> {
  const list = picked.map((p) => p.raw);
  const horizon = Math.min(24, Math.max(1, Math.round(planHorizon)));
  const out = new Map<string, { startMonth: number; durationMonths: number; timingReason: string }>();

  const webRaw = list.find((r) => r.family === "fam_web");
  const stratRaw = list.find((r) => r.family === "fam_estrategia" || r.kind === "strategy");

  let webEnd = 0;
  if (webRaw) {
    const t = suggestTimingForService(
      { family: webRaw.family, kind: webRaw.kind, service: webRaw.service },
      signals,
      strategyApproved,
      horizon,
      1
    );
    out.set(webRaw.service.id, t);
    webEnd = t.startMonth + t.durationMonths - 1;
  }

  let stratEnd = 0;
  if (stratRaw) {
    const t = suggestTimingForService(
      { family: stratRaw.family, kind: stratRaw.kind, service: stratRaw.service },
      signals,
      strategyApproved,
      horizon,
      1
    );
    out.set(stratRaw.service.id, t);
    stratEnd = t.startMonth + t.durationMonths - 1;
  }

  for (const r of list) {
    if (out.has(r.service.id)) continue;
    let depMin = 1;
    if (r.family === "fam_pauta" || r.kind === "demand") {
      if (webRaw) depMin = Math.max(depMin, webEnd + 1);
      else if (stratRaw) depMin = Math.max(depMin, stratEnd + 1);
    }
    if (r.family === "fam_seo" || r.family === "fam_contenido") {
      depMin = Math.max(depMin, webRaw ? 2 : 1);
      if (stratRaw && !webRaw) depMin = Math.max(depMin, Math.min(3, stratEnd + 1));
    }
    if (r.family === "fam_linkedin") {
      depMin = Math.max(depMin, stratRaw ? Math.min(2, stratEnd + 1) : 1);
    }

    const t = suggestTimingForService(
      { family: r.family, kind: r.kind, service: r.service },
      signals,
      strategyApproved,
      horizon,
      depMin
    );
    let reason = t.timingReason;
    if ((r.family === "fam_pauta" || r.kind === "demand") && webRaw) {
      reason += ` Pauta no antes del cierre sugerido de la base web (inicio mes ${t.startMonth}).`;
    }
    out.set(r.service.id, { ...t, timingReason: reason });
  }

  return out;
}

/** Visual + copy para la prioridad ya calculada en `suggested`. */
function strategicPriorityBadgeClass(p: Suggested["priority"]): string {
  switch (p) {
    case "alta":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "media":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "baja":
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function strategicPriorityLabel(p: Suggested["priority"]): string {
  switch (p) {
    case "alta":
      return "Alta prioridad";
    case "media":
      return "Prioridad media";
    case "baja":
      return "Baja prioridad";
  }
}

export function Leads87ServicesWorkspace({
  leadId,
  aiReport,
  strategyApproved = false,
  strategyContextText = "",
  proposalConfirmedAt,
  onStructureConfirmed,
  onConfirmReadinessChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<EasyService[]>([]);
  const [rows, setRows] = useState<LeadServiceProposal[]>([]);
  /** Ediciones locales de mes / precio unit. / cant.; se envían al confirmar estructura. */
  const [proposalDrafts, setProposalDrafts] = useState<Record<string, ProposalRowDraft>>({});
  const [months, setMonths] = useState(6);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  const [selectedQty, setSelectedQty] = useState("");
  const [selectedScope, setSelectedScope] = useState("");
  const [selectedNotes, setSelectedNotes] = useState("");
  const [addServiceAdvancedOpen, setAddServiceAdvancedOpen] = useState(false);
  const [addFromMonth, setAddFromMonth] = useState(1);
  const [aiRecommendations, setAiRecommendations] = useState<ServiceRecommendationRaw[] | null>(null);
  const [aiDropped, setAiDropped] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [internalBreakdownByServiceId, setInternalBreakdownByServiceId] = useState<
    Map<string, InternalCostBreakdownLine[]>
  >(() => new Map());
  const [internalCostLoading, setInternalCostLoading] = useState(false);
  const [internalCostForbidden, setInternalCostForbidden] = useState(false);
  const maxMesInDrafts = useMemo(() => {
    if (rows.length === 0) return 1;
    return rows.reduce((max, r) => {
      const d = proposalDrafts[r.id] ?? draftFromRow(r, catalog);
      return Math.max(max, d.mes);
    }, 1);
  }, [rows, proposalDrafts, catalog]);

  const effectiveMonthCount = Math.max(1, Math.min(24, Math.max(months, maxMesInDrafts)));
  const cols = useMemo(() => getCols(effectiveMonthCount), [effectiveMonthCount]);
  const confirmed = Boolean(proposalConfirmedAt?.trim());
  const canConfirmStructure = !loading && !confirmed && rows.length > 0 && strategyApproved;

  const persistAiDraft = useCallback(
    (list: ServiceRecommendationRaw[] | null) => {
      try {
        const key = `${AI_REC_STORAGE_PREFIX}${leadId}`;
        if (list == null || list.length === 0) {
          sessionStorage.removeItem(key);
          return;
        }
        sessionStorage.setItem(key, JSON.stringify({ recommendations: list, savedAt: Date.now() }));
      } catch {
        /* ignore */
      }
    },
    [leadId]
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`${AI_REC_STORAGE_PREFIX}${leadId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { recommendations?: ServiceRecommendationRaw[] };
      if (Array.isArray(parsed?.recommendations) && parsed.recommendations.length > 0) {
        setAiRecommendations(parsed.recommendations);
      }
    } catch {
      /* ignore */
    }
  }, [leadId]);

  useEffect(() => {
    persistAiDraft(aiRecommendations);
  }, [aiRecommendations, persistAiDraft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [catRes, leadRes] = await Promise.all([
          fetch("/api/admin/services", { cache: "no-store" }).then((r) => r.json()),
          fetch(`/api/admin/leads/${leadId}/services`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setCatalog(Array.isArray(catRes?.services) ? catRes.services : []);
        setRows(Array.isArray(leadRes?.services) ? leadRes.services : []);
      } catch {
        if (!cancelled) setError("No se pudo cargar la propuesta de servicios.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    setProposalDrafts((prev) => {
      const next: Record<string, ProposalRowDraft> = {};
      for (const r of rows) {
        const fresh = draftFromRow(r, catalog);
        const prevD = prev[r.id];
        if (!prevD) {
          next[r.id] = fresh;
          continue;
        }
        next[r.id] = {
          ...fresh,
          unit_price: prevD.unit_price,
          quantity: prevD.quantity,
          mes: prevD.mes,
          activeUntilMonth: prevD.activeUntilMonth,
          catalog_billing: fresh.catalog_billing,
          monthValueOverrides: prevD.monthValueOverrides,
        };
      }
      return next;
    });
  }, [rows, catalog]);

  const selectedService = useMemo(() => catalog.find((s) => s.id === selectedServiceId) ?? null, [catalog, selectedServiceId]);

  useEffect(() => {
    if (selectedService?.alcance_base) setSelectedScope(selectedService.alcance_base);
  }, [selectedServiceId, selectedService]);

  useEffect(() => {
    if (!selectedService) return;
    setSelectedPrice(selectedService.precio_base != null ? String(selectedService.precio_base) : "");
    const dq = selectedService.default_quantity ?? 1;
    setSelectedQty(String(dq > 0 ? dq : 1));
  }, [selectedService]);

  const suggested = useMemo(
    () =>
      buildRankedStrategicSuggestions(
        catalog,
        rows,
        aiReport,
        strategyContextText,
        strategyApproved,
        effectiveMonthCount
      ),
    [catalog, rows, aiReport, strategyContextText, strategyApproved, effectiveMonthCount]
  );

  const byMonthTotal = useMemo(() => {
    const planEnd = effectiveMonthCount;
    const totals: Record<string, number> = {};
    cols.forEach((c, idx) => {
      const m = idx + 1;
      totals[c.key] = rows.reduce((sum, r) => {
        const d = proposalDrafts[r.id] ?? draftFromRow(r, catalog);
        if (!rowActiveInMonth(m, d, planEnd)) return sum;
        return sum + effectiveMonthCellValue(d, c.key, m, planEnd);
      }, 0);
    });
    return totals;
  }, [rows, cols, proposalDrafts, catalog, effectiveMonthCount]);

  const grandTotalPropuesta = useMemo(() => {
    const planEnd = effectiveMonthCount;
    return rows.reduce((sum, r) => {
      const d = proposalDrafts[r.id] ?? draftFromRow(r, catalog);
      return sum + lineTotalInPlanWithOverrides(d, cols, planEnd);
    }, 0);
  }, [rows, proposalDrafts, catalog, effectiveMonthCount, cols]);

  const uniqueAgencyServiceIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const id = (r.agency_service_id ?? r.service_id ?? "").trim();
      if (id) s.add(id);
    }
    return [...s];
  }, [rows]);

  const loadInternalBreakdowns = useCallback(async () => {
    if (uniqueAgencyServiceIds.length === 0) {
      setInternalBreakdownByServiceId(new Map());
      setInternalCostForbidden(false);
      return;
    }
    setInternalCostLoading(true);
    setInternalCostForbidden(false);
    try {
      const results = await Promise.all(
        uniqueAgencyServiceIds.map(async (sid) => {
          const res = await fetch(
            `/api/admin/agency-service-effort-profiles?agency_service_id=${encodeURIComponent(sid)}`,
            { cache: "no-store" }
          );
          const json = (await res.json().catch(() => ({}))) as { ok?: boolean; profiles?: unknown[] };
          if (res.status === 403) return { sid, forbidden: true as const, lines: [] as InternalCostBreakdownLine[] };
          if (!res.ok || !json?.ok) return { sid, forbidden: false as const, lines: [] as InternalCostBreakdownLine[] };
          const profiles = Array.isArray(json.profiles) ? json.profiles : [];
          const lines = profiles.map((p) =>
            computeLineFromEffortProfileRow(p as Parameters<typeof computeLineFromEffortProfileRow>[0])
          );
          return { sid, forbidden: false as const, lines };
        })
      );
      if (results.some((x) => x.forbidden)) setInternalCostForbidden(true);
      const m = new Map<string, InternalCostBreakdownLine[]>();
      for (const r of results) {
        if (!r.forbidden) m.set(r.sid, r.lines);
      }
      setInternalBreakdownByServiceId(m);
    } catch {
      setInternalBreakdownByServiceId(new Map());
    } finally {
      setInternalCostLoading(false);
    }
  }, [uniqueAgencyServiceIds]);

  useEffect(() => {
    void loadInternalBreakdowns();
  }, [loadInternalBreakdowns]);

  const commercialSummary = useMemo(() => {
    const planEnd = effectiveMonthCount;
    let estimatedInternal = 0;
    let hasEffortProfileRows = false;
    for (const r of rows) {
      const d = proposalDrafts[r.id] ?? draftFromRow(r, catalog);
      const sid = (r.agency_service_id ?? r.service_id ?? "").trim();
      if (!sid) continue;
      const lines = internalBreakdownByServiceId.get(sid) ?? [];
      if (lines.length > 0) hasEffortProfileRows = true;
      const unitInternal = sumInternalCost(lines);
      const occurrences = countSpreadMonths(d, planEnd);
      const qty = draftQuantityForCost(d);
      estimatedInternal += unitInternal * qty * occurrences;
    }
    const avgMonthly = planEnd > 0 ? grandTotalPropuesta / planEnd : 0;
    return {
      estimatedInternal,
      avgMonthly,
      marginEstimated: grandTotalPropuesta - estimatedInternal,
      hasEffortProfileRows,
    };
  }, [rows, proposalDrafts, catalog, effectiveMonthCount, internalBreakdownByServiceId, grandTotalPropuesta]);

  const proposalMonedaHint = useMemo(() => {
    const m = rows.find((r) => r.moneda?.trim())?.moneda?.trim();
    return m ?? null;
  }, [rows]);

  const internalCostPending = internalCostLoading && uniqueAgencyServiceIds.length > 0;

  const summaryCurrency = proposalMonedaHint ?? "USD";

  const showCommercialInternalDash =
    !internalCostPending &&
    uniqueAgencyServiceIds.length > 0 &&
    !commercialSummary.hasEffortProfileRows;

  const phaseRows = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const d = proposalDrafts[r.id] ?? draftFromRow(r, catalog);
        const bt = String(r.billing_type ?? "").toLowerCase();
        const phase =
          bt === "one_time" && d.mes === 1
            ? "Diagnóstico y Base"
            : bt === "monthly"
              ? "Optimización y Crecimiento"
              : "Implementación";
        acc[phase].push(r);
        return acc;
      },
      {
        "Diagnóstico y Base": [] as LeadServiceProposal[],
        Implementación: [] as LeadServiceProposal[],
        "Optimización y Crecimiento": [] as LeadServiceProposal[],
      }
    );
  }, [rows, proposalDrafts, catalog]);

  async function reloadRows(): Promise<LeadServiceProposal[]> {
    const json = await fetch(`/api/admin/leads/${leadId}/services`, { cache: "no-store" }).then((r) => r.json());
    const nextRows = Array.isArray(json?.services) ? (json.services as LeadServiceProposal[]) : [];
    setRows(nextRows);
    return nextRows;
  }

  async function generateAiRecommendations() {
    setAiBusy(true);
    setAiError(null);
    setAiDropped([]);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/service-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudieron generar recomendaciones");
      const list = Array.isArray(json.recommendations) ? json.recommendations : [];
      setAiRecommendations(list as ServiceRecommendationRaw[]);
      setAiDropped(Array.isArray(json.dropped_invalid_codes) ? json.dropped_invalid_codes : []);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Error");
      setAiRecommendations(null);
    } finally {
      setAiBusy(false);
    }
  }

  function updateAiRecommendation(index: number, next: ServiceRecommendationRaw) {
    setAiRecommendations((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  }

  function updateAiRoleHours(recIndex: number, roleIdx: number, hours: number) {
    setAiRecommendations((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      const r = { ...copy[recIndex] };
      const hrs = [...(r.adjusted_role_hours ?? [])];
      if (hrs[roleIdx]) {
        hrs[roleIdx] = { ...hrs[roleIdx], hours: Math.max(0, hours) };
        r.adjusted_role_hours = hrs;
        copy[recIndex] = r;
      }
      return copy;
    });
  }

  function buildScopeFromAi(rec: ServiceRecommendationRaw): string {
    const lines =
      rec.adjusted_role_hours?.map((h) => `- ${h.role_name?.trim() || h.role_code}: ${h.hours} h`) ?? [];
    const effort =
      lines.length > 0 ? ["Horas por rol (ajustadas):", ...lines].join("\n") : "";
    return [rec.reason?.trim(), effort].filter(Boolean).join("\n\n");
  }

  function buildNotesFromAi(rec: ServiceRecommendationRaw): string {
    const parts = [rec.suggested_client_note?.trim()].filter(Boolean) as string[];
    if (rec.suggested_ad_spend != null && Number.isFinite(Number(rec.suggested_ad_spend))) {
      parts.push(`Inversión en pauta sugerida: ${Number(rec.suggested_ad_spend).toLocaleString("es-UY")}`);
    }
    return parts.join("\n\n");
  }

  async function applyAiRecommendation(rec: ServiceRecommendationRaw) {
    const sid = rec.service_code?.trim();
    if (!sid) return;
    const used = new Set(
      rows.flatMap((r) => [r.service_id, r.agency_service_id].filter((x): x is string => Boolean(x && String(x).trim())))
    );
    if (used.has(sid)) {
      if (!confirm("Este servicio ya está en la propuesta. ¿Agregarlo de todas formas (línea duplicada)?")) return;
    }
    await addService(sid, buildScopeFromAi(rec), buildNotesFromAi(rec), null, rec.quantity);
  }

  async function addService(
    serviceId: string,
    scope?: string,
    notes?: string,
    unitPrice?: number | null,
    quantity?: number | null,
    timingPrefill?: { startMonth: number; durationMonths: number }
  ) {
    if (!serviceId) return;
    const cat = catalog.find((c) => c.id === serviceId);
    const prefillRange = timingPrefill
      ? clampSuggestedActiveRange(timingPrefill.startMonth, timingPrefill.durationMonths, effectiveMonthCount)
      : null;
    const startMes = prefillRange?.start ?? Math.max(1, Math.min(24, Math.round(addFromMonth)));
    const up = unitPrice != null && Number.isFinite(Number(unitPrice)) ? Number(unitPrice) : Number(cat?.precio_base ?? 0);
    const qRaw = quantity != null && Number.isFinite(Number(quantity)) ? Number(quantity) : Number(cat?.default_quantity ?? 1);
    const qty = qRaw > 0 ? qRaw : 1;
    const total = up * qty;
    const prevIds = new Set(rows.map((r) => r.id));
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_service_id: serviceId,
          mes: startMes,
          unit_price: up,
          quantity: qty,
          precio: total,
          alcance_editado: scope?.trim() || null,
          observaciones: notes?.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo agregar el servicio.");
      const nextRows = await reloadRows();
      if (prefillRange) {
        const addedCandidates = nextRows.filter(
          (r) =>
            !prevIds.has(r.id) &&
            ((r.agency_service_id ?? r.service_id ?? "").trim() === serviceId)
        );
        const added = addedCandidates[addedCandidates.length - 1];
        if (added) {
          setProposalDrafts((prev) => {
            const current = prev[added.id] ?? draftFromRow(added, catalog);
            return {
              ...prev,
              [added.id]: {
                ...current,
                mes: prefillRange.start,
                activeUntilMonth: prefillRange.end,
              },
            };
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar el servicio.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(proposalId: string) {
    if (!confirm("¿Eliminar este servicio de la propuesta?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/services/${proposalId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "No se pudo eliminar.");
      await reloadRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setSaving(false);
    }
  }

  function patchProposalDraft(rowId: string, patch: Partial<ProposalRowDraft>) {
    setProposalDrafts((prev) => {
      const row = rows.find((x) => x.id === rowId);
      if (!row) return prev;
      const cur = prev[rowId] ?? draftFromRow(row, catalog);
      let mes = patch.mes !== undefined ? Math.round(Number(patch.mes)) : cur.mes;
      mes = Math.max(1, Math.min(24, mes));
      let unit_price = patch.unit_price !== undefined ? Number(patch.unit_price) : cur.unit_price;
      if (!Number.isFinite(unit_price) || unit_price < 0) unit_price = 0;
      let quantity = patch.quantity !== undefined ? Number(patch.quantity) : cur.quantity;
      if (!Number.isFinite(quantity) || quantity <= 0) quantity = 0.01;
      const catalog_billing = patch.catalog_billing ?? cur.catalog_billing;
      const base: ProposalRowDraft = {
        mes,
        unit_price,
        quantity,
        catalog_billing,
        monthValueOverrides: cur.monthValueOverrides,
      };
      const monthValueOverrides = pruneMonthOverrides(base, cols, effectiveMonthCount);
      return { ...prev, [rowId]: { ...base, monthValueOverrides } };
    });
  }

  function patchMonthCellOverride(rowId: string, colKey: string, value: number) {
    setProposalDrafts((prev) => {
      const row = rows.find((x) => x.id === rowId);
      if (!row) return prev;
      const cur = prev[rowId] ?? draftFromRow(row, catalog);
      const v = Number.isFinite(value) ? Math.max(0, value) : 0;
      const nextOverrides: Partial<Record<string, number>> = { ...cur.monthValueOverrides, [colKey]: v };
      const base: ProposalRowDraft = { ...cur, monthValueOverrides: nextOverrides };
      const monthValueOverrides = pruneMonthOverrides(base, cols, effectiveMonthCount);
      return { ...prev, [rowId]: { ...base, monthValueOverrides } };
    });
  }

  function clearMonthCellOverride(rowId: string, colKey: string) {
    setProposalDrafts((prev) => {
      const row = rows.find((x) => x.id === rowId);
      if (!row) return prev;
      const cur = prev[rowId] ?? draftFromRow(row, catalog);
      const ov = cur.monthValueOverrides;
      if (!ov || ov[colKey] === undefined) return prev;
      const nextOverrides = { ...ov };
      delete nextOverrides[colKey];
      const monthValueOverrides =
        Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined;
      return { ...prev, [rowId]: { ...cur, monthValueOverrides } };
    });
  }

  async function confirmStructure() {
    setConfirming(true);
    setError(null);
    try {
      const draft = {
        months: cols.map((c) => ({ key: c.key, label: c.label })),
        rows: rows.map((r) => {
          const d = proposalDrafts[r.id] ?? draftFromRow(r, catalog);
          const sid = (r.agency_service_id ?? r.service_id ?? "").trim();
          const planEnd = effectiveMonthCount;
          const valuesByMonth = buildValuesByMonthForConfirm(d, cols, planEnd);
          const base: Record<string, unknown> = {
            proposalId: r.id,
            serviceId: sid,
            valuesByMonth,
          };
          if (r.agency_snapshot) base.agencySnapshot = r.agency_snapshot;
          return base;
        }),
      };
      const res = await fetch(`/api/admin/leads/${leadId}/proposal/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo confirmar.");
      onStructureConfirmed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar.");
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    onConfirmReadinessChange?.(canConfirmStructure, confirming);
  }, [canConfirmStructure, confirming, onConfirmReadinessChange]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Armá la propuesta comercial inteligente sin salir de LEADS87: sugerencias, estructura por mes, narrativa y fases.
      </p>
      {strategyApproved ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">Estrategia confirmada</span>
          <span>Podés armar la estructura de servicios y confirmarla cuando esté lista.</span>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="font-semibold">Estrategia pendiente.</span> Volvé al Paso 3 y confirmá la estrategia comercial para
          habilitar la confirmación de estructura de servicios. Las sugerencias usan el informe solo como respaldo hasta que
          haya texto de estrategia.
        </div>
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <p className="text-sm text-slate-500">Cargando catálogo y propuesta…</p>
      ) : (
        <>
          <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Servicios sugeridos</h3>
            <p className="mt-1 text-xs font-medium text-slate-600">Vía principal — validación diagnóstico + estrategia + etapa</p>
            {strategyApproved ? (
              <p className="mt-2 text-xs text-slate-600">
                Lista acotada (máx. {MAX_STRATEGIC_SUGGESTIONS}): cada ítem suma señales de informe, estrategia, diagnóstico y
                catálogo; se ordena por puntuación y se respeta una variante por familia excluyente.
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-800">
                Sin estrategia confirmada se exige más respaldo en el texto y un encaje más fuerte en catálogo; se penalizan
                coincidencias aisladas.
              </p>
            )}
            <div className="mt-3 space-y-2">
              {suggested.length === 0 ? (
                <p className="text-xs text-slate-500">Sin sugerencias automáticas por ahora.</p>
              ) : (
                suggested.map((s) => (
                  <div
                    key={s.service.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5"
                    title={`${strategicPriorityLabel(s.priority)} · ${s.familyDecisionReason} ${s.variantDecisionReason}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${strategicPriorityBadgeClass(s.priority)}`}
                          >
                            {strategicPriorityLabel(s.priority)}
                          </span>
                          <p className="text-sm font-medium text-slate-900">{s.service.codigo} — {s.service.nombre}</p>
                        </div>
                        <div className="mt-2 space-y-1 text-xs leading-snug text-slate-700">
                          <p>{s.pitch.diagnosis}</p>
                          <p>{s.pitch.problem}</p>
                          <p>{s.pitch.impact}</p>
                        </div>
                        <div className="mt-2 border-l-2 border-slate-200 pl-2.5">
                          <p className="text-xs leading-snug text-slate-500">
                            <span className="font-medium text-slate-600">Variante recomendada:</span>{" "}
                            {s.variantDecisionReason}
                          </p>
                          <p className="mt-1 text-[11px] leading-snug text-slate-500">{s.familyDecisionReason}</p>
                        </div>
                        <p className="mt-2 text-xs leading-snug text-slate-500">
                          <span className="font-medium text-slate-600">Plan sugerido:</span> desde mes {s.suggestedStartMonth},{" "}
                          {s.suggestedDurationMonths} {s.suggestedDurationMonths === 1 ? "mes activo" : "meses activos"} —{" "}
                          {s.timingReason}
                        </p>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Por qué aparece</p>
                        {s.evidenceChips.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {s.evidenceChips.map((chip, idx) => (
                              <span
                                key={idx}
                                className="inline-block max-w-full rounded-full border border-indigo-200/90 bg-indigo-50 px-2.5 py-1 text-[10px] font-medium leading-snug text-indigo-950"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-[10px] text-slate-500">
                            Sin fragmento breve del informe en esta vista; la sugerencia sigue apoyada en tema + catálogo (score{" "}
                            {s.score}).
                          </p>
                        )}
                        <p className="mt-2 text-[10px] text-slate-500">
                          Encaje comercial (score): <span className="font-semibold tabular-nums text-slate-800">{s.score}</span>
                        </p>
                        <div className="mt-2 rounded-md border border-slate-100 bg-white/90 px-2.5 py-2 text-[11px] leading-snug text-slate-600">
                          <p>
                            <span className="font-semibold text-slate-700">Familia:</span> {s.decision.familyLabel}
                          </p>
                          <p className="mt-2">
                            <span className="font-semibold text-slate-700">Variante:</span> {s.decision.variantLabel}
                          </p>
                          <p className="mt-2">
                            <span className="font-semibold text-slate-700">Encaje:</span> {s.decision.strategicJustification}
                          </p>
                          <p className="mt-2">
                            <span className="font-semibold text-slate-700">Duración esperada:</span> {s.decision.expectedDuration}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          addService(
                            s.service.id,
                            s.service.alcance_base ?? undefined,
                            [
                              `Sugerido (${s.priority}) · score ${s.score}`,
                              `Familia: ${s.decision.familyLabel} (${s.family})`,
                              `Decisión familia: ${s.familyDecisionReason}`,
                              `Decisión variante: ${s.variantDecisionReason}`,
                              `Timing sugerido: mes ${s.suggestedStartMonth}, ${s.suggestedDurationMonths} mes(es) — ${s.timingReason}`,
                              s.evidenceChips.length ? `Evidencia: ${s.evidenceChips.join(" | ")}` : null,
                              `Encaje: ${s.strategicJustification}`,
                              s.pitch.diagnosis,
                              s.pitch.problem,
                              s.impact,
                            ]
                              .filter(Boolean)
                              .join("\n\n"),
                            s.service.precio_base ?? null,
                            s.service.default_quantity ?? null,
                            {
                              startMonth: s.suggestedStartMonth,
                              durationMonths: s.suggestedDurationMonths,
                            }
                          )
                        }
                        disabled={saving || confirmed}
                        className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100/80 disabled:opacity-50"
                      >
                        Agregar sugerencia
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <details className="group rounded-xl border border-indigo-200/70 bg-indigo-50/40">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <span className="text-sm font-medium text-indigo-900/85">Borrador IA avanzado</span>
                <span className="mt-0.5 block text-xs text-indigo-800/65">
                  Opcional — generá recomendaciones desde el catálogo y editá antes de agregar (se guarda en esta sesión).
                </span>
              </div>
              <span
                className="mt-0.5 shrink-0 text-[10px] font-normal text-indigo-500 transition-transform group-open:rotate-180"
                aria-hidden
              >
                ▼
              </span>
            </summary>
            <div className="border-t border-indigo-100/90 px-4 pb-4 pt-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-indigo-950">Recomendaciones IA (catálogo agencia)</h3>
                <p className="mt-1 text-xs text-indigo-900/85">
                  La IA solo elige servicios existentes (UUID = service_code). Podés editar prioridad, cantidad, horas por rol,
                  notas y pauta antes de sumar a la propuesta. El borrador se guarda en esta sesión.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generateAiRecommendations()}
                  disabled={aiBusy || confirmed}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {aiBusy ? "Generando…" : "Generar / actualizar con IA"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiRecommendations(null);
                    setAiDropped([]);
                    setAiError(null);
                  }}
                  disabled={confirmed}
                  className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-900 disabled:opacity-50"
                >
                  Limpiar borrador
                </button>
              </div>
            </div>
            {aiError && <p className="mt-2 text-xs text-red-700">{aiError}</p>}
            {aiDropped.length > 0 && (
              <p className="mt-2 text-xs text-amber-800">
                Códigos descartados (no válidos en catálogo): {aiDropped.join(", ")}
              </p>
            )}
            {aiRecommendations && aiRecommendations.length === 0 && !aiBusy && (
              <p className="mt-2 text-xs text-slate-600">La IA no devolvió ítems válidos. Reintentá o completá más contexto (investigación / estrategia).</p>
            )}
            {aiRecommendations && aiRecommendations.length > 0 && (
              <ul className="mt-3 space-y-3">
                {aiRecommendations.map((rec, idx) => {
                  const cat = catalog.find((c) => c.id === rec.service_code);
                  const label = cat ? [cat.codigo, cat.nombre].filter(Boolean).join(" — ") || cat.nombre : rec.service_code;
                  return (
                    <li key={`${rec.service_code}-${idx}`} className="rounded-lg border border-indigo-100 bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{label}</p>
                          <p className="text-[10px] text-slate-500">service_code: {rec.service_code}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void applyAiRecommendation(rec)}
                          disabled={saving || confirmed}
                          className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Agregar a propuesta
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="block text-xs text-slate-600">
                          Prioridad (1–5)
                          <input
                            type="number"
                            min={1}
                            max={5}
                            step={1}
                            value={rec.priority}
                            disabled={confirmed}
                            onChange={(e) =>
                              updateAiRecommendation(idx, {
                                ...rec,
                                priority: Math.min(5, Math.max(1, Math.round(Number(e.target.value) || 1))),
                              })
                            }
                            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="block text-xs text-slate-600">
                          Cantidad
                          <input
                            type="number"
                            min={0.01}
                            step={0.25}
                            value={rec.quantity}
                            disabled={confirmed}
                            onChange={(e) =>
                              updateAiRecommendation(idx, { ...rec, quantity: Math.max(0.01, Number(e.target.value) || 1) })
                            }
                            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="block text-xs text-slate-600 sm:col-span-2">
                          Pauta sugerida (opcional)
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={rec.suggested_ad_spend ?? ""}
                            disabled={confirmed}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateAiRecommendation(idx, {
                                ...rec,
                                suggested_ad_spend: v === "" ? null : Math.max(0, Number(v)),
                              });
                            }}
                            placeholder="—"
                            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                      <label className="mt-2 block text-xs text-slate-600">
                        Motivo (interno)
                        <textarea
                          value={rec.reason}
                          disabled={confirmed}
                          onChange={(e) => updateAiRecommendation(idx, { ...rec, reason: e.target.value })}
                          rows={2}
                          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </label>
                      {rec.adjusted_role_hours && rec.adjusted_role_hours.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-slate-700">Horas por rol (editables)</p>
                          <ul className="mt-1 space-y-1">
                            {rec.adjusted_role_hours.map((rh, j) => (
                              <li key={`${rh.role_code}-${j}`} className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="min-w-[120px] text-slate-700">{rh.role_name || rh.role_code}</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.25}
                                  value={rh.hours}
                                  disabled={confirmed}
                                  onChange={(e) => updateAiRoleHours(idx, j, Number(e.target.value))}
                                  className="w-24 rounded border border-slate-300 px-2 py-0.5"
                                />
                                <span className="text-slate-500">h</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <label className="mt-2 block text-xs text-slate-600">
                        Nota sugerida para el cliente
                        <textarea
                          value={rec.suggested_client_note}
                          disabled={confirmed}
                          onChange={(e) => updateAiRecommendation(idx, { ...rec, suggested_client_note: e.target.value })}
                          rows={2}
                          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          </details>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800">Agregar servicio a la propuesta</h3>
            <p className="mt-1 text-xs text-slate-500">Elegí servicio, revisá precio y cantidad (se completan desde el catálogo) y agregá. Alcance y notas son opcionales.</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block min-w-[200px] flex-1 text-xs text-slate-600">
                Servicio
                <select
                  value={selectedServiceId}
                  disabled={confirmed}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">— Seleccionar —</option>
                  {catalog.map((s) => (
                    <option key={s.id} value={s.id}>
                      {[s.codigo, s.nombre].filter(Boolean).join(" — ") || s.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-full min-w-[7rem] sm:w-32 text-xs text-slate-600">
                Precio unit.
                <input
                  value={selectedPrice}
                  onChange={(e) => setSelectedPrice(e.target.value)}
                  type="number"
                  step={0.01}
                  min={0}
                  disabled={confirmed}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block w-full min-w-[6rem] sm:w-28 text-xs text-slate-600">
                Cantidad
                <input
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(e.target.value)}
                  type="number"
                  step={0.01}
                  min={0.01}
                  disabled={confirmed}
                  placeholder="1"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block w-full min-w-[6.5rem] sm:w-32 text-xs text-slate-600">
                Desde mes
                <select
                  value={addFromMonth}
                  disabled={confirmed}
                  onChange={(e) => setAddFromMonth(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      Mes {m}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  addService(
                    selectedServiceId,
                    selectedScope,
                    selectedNotes,
                    selectedPrice === "" ? null : Number(selectedPrice),
                    selectedQty === "" ? null : Number(selectedQty)
                  )
                }
                disabled={saving || confirmed || !selectedServiceId.trim()}
                className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 sm:ml-auto sm:w-auto sm:min-w-[10rem]"
              >
                Agregar a propuesta
              </button>
            </div>
            <div className="mt-2">
              <button
                type="button"
                disabled={confirmed}
                onClick={() => setAddServiceAdvancedOpen((v) => !v)}
                className="text-xs font-medium text-indigo-700 hover:text-indigo-900 hover:underline disabled:opacity-50"
              >
                {addServiceAdvancedOpen ? "Ocultar opciones avanzadas" : "Ver opciones avanzadas"}
              </button>
            </div>
            {addServiceAdvancedOpen ? (
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                <label className="block text-xs text-slate-600">
                  Alcance editable
                  <textarea
                    value={selectedScope}
                    onChange={(e) => setSelectedScope(e.target.value)}
                    rows={2}
                    disabled={confirmed}
                    placeholder="Opcional — se puede completar después"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  Observaciones
                  <textarea
                    value={selectedNotes}
                    onChange={(e) => setSelectedNotes(e.target.value)}
                    rows={2}
                    disabled={confirmed}
                    placeholder="Opcional — interno"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            ) : null}
          </div>

          {rows.length > 0 ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">Resumen comercial</h3>
                {proposalMonedaHint ? (
                  <span className="text-[11px] text-slate-500">Moneda referencia: {proposalMonedaHint}</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Total y promedio reflejan exactamente lo que ves en la grilla, mes a mes, incluyendo importes ajustados a mano.
              </p>
              {internalCostForbidden ? (
                <p className="mt-2 text-xs text-amber-800">
                  Sin permiso para cargar horas por rol: el costo interno puede mostrarse incompleto. Revisá en Admin →
                  Servicios.
                </p>
              ) : null}
              {internalCostPending ? (
                <p className="mt-1 text-xs text-slate-500">Actualizando costo interno desde perfiles de esfuerzo…</p>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total propuesta</p>
                  <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
                    {formatProposalCurrency(grandTotalPropuesta, summaryCurrency)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">Igual al total general al pie de la tabla</p>
                </div>
                <div className="rounded-lg border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Promedio mensual</p>
                  <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
                    {formatProposalCurrency(commercialSummary.avgMonthly, summaryCurrency)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">Total propuesta ÷ {effectiveMonthCount} (meses del plan)</p>
                </div>
                <div className="rounded-lg border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Costo interno estimado</p>
                  <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
                    {internalCostPending ? (
                      <span className="text-slate-400">…</span>
                    ) : showCommercialInternalDash ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      formatProposalCurrency(commercialSummary.estimatedInternal, summaryCurrency)
                    )}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Perfil de esfuerzo del servicio × cantidad del borrador × meses activos de la línea
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Margen estimado</p>
                  <p
                    className={`mt-1.5 text-xl font-semibold tabular-nums tracking-tight ${
                      internalCostPending || showCommercialInternalDash ? "text-slate-400" : "text-slate-900"
                    }`}
                  >
                    {internalCostPending ? (
                      "…"
                    ) : showCommercialInternalDash ? (
                      "—"
                    ) : (
                      formatProposalCurrency(commercialSummary.marginEstimated, summaryCurrency)
                    )}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">Total propuesta − costo interno estimado</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Propuesta por mes</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Los servicios <span className="font-medium text-slate-700">mensuales</span> del catálogo se repiten en el
                  borrador desde &quot;Desde mes&quot; hasta el último mes del plan (+/− Mes). Puntuales, proyecto y por hora: un
                  solo mes. Podés ajustar el importe mes a mes en cada celda; si no lo tocás, se usa el subtotal automático
                  (P. unit. × cant.). Totales y confirmación usan esos valores efectivos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMonths((m) => Math.max(1, m - 1))} disabled={confirmed} className="rounded border px-2 py-1 text-xs">- Mes</button>
                <button type="button" onClick={() => setMonths((m) => Math.min(24, m + 1))} disabled={confirmed} className="rounded border px-2 py-1 text-xs">+ Mes</button>
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay servicios cargados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="px-2 py-2 text-left">Servicio</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap">Desde mes</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">P. unit.</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">Cant.</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">Subt.</th>
                      {cols.map((c) => (
                        <th key={c.key} className="px-2 py-2 text-right whitespace-nowrap min-w-[4.5rem]">
                          {c.label}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const d = proposalDrafts[r.id] ?? draftFromRow(r, catalog);
                      const subt = lineSubtotal(d);
                      const spreadN = countSpreadMonths(d, effectiveMonthCount);
                      return (
                        <tr key={r.id} className="border-b">
                          <td className="px-2 py-2 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="w-fit rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                {billingLabelShort(d.catalog_billing)}
                              </span>
                              <span className="text-slate-900">{[r.codigo, r.nombre].filter(Boolean).join(" — ")}</span>
                            </div>
                          </td>
                          <td className="px-1 py-1.5 align-top">
                            <select
                              value={d.mes}
                              disabled={confirmed}
                              onChange={(e) => patchProposalDraft(r.id, { mes: Number(e.target.value) })}
                              className="w-full min-w-[5.5rem] rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-900 disabled:bg-slate-50"
                            >
                              {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m}>
                                  Mes {m}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1 py-1.5 align-top">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              disabled={confirmed}
                              value={d.unit_price}
                              onChange={(e) => patchProposalDraft(r.id, { unit_price: Number(e.target.value) })}
                              className="w-full min-w-[5rem] rounded border border-slate-300 px-1.5 py-1 text-right text-xs text-slate-900 disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-1 py-1.5 align-top">
                            <input
                              type="number"
                              min={0.01}
                              step={0.25}
                              disabled={confirmed}
                              value={d.quantity}
                              onChange={(e) => patchProposalDraft(r.id, { quantity: Number(e.target.value) })}
                              className="w-full min-w-[4rem] rounded border border-slate-300 px-1.5 py-1 text-right text-xs text-slate-900 disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-900">
                            <div>{subt.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                            {d.catalog_billing === "monthly" && spreadN > 1 ? (
                              <div className="mt-0.5 text-[10px] font-normal text-slate-500">× {spreadN} meses en plan</div>
                            ) : null}
                          </td>
                          {cols.map((c, i) => {
                            const m = i + 1;
                            const active = rowActiveInMonth(m, d, effectiveMonthCount);
                            const cellVal = effectiveMonthCellValue(d, c.key, m, effectiveMonthCount);
                            const hasOverride = d.monthValueOverrides?.[c.key] !== undefined;
                            return (
                              <td
                                key={c.key}
                                className="px-1 py-1.5 align-top text-right tabular-nums text-slate-800"
                              >
                                {active ? (
                                  <div
                                    className={
                                      hasOverride
                                        ? "flex flex-col items-end gap-0.5 rounded-md border border-sky-200/80 bg-sky-50/70 p-1"
                                        : "flex flex-col items-end gap-0.5"
                                    }
                                  >
                                    {hasOverride ? (
                                      <span className="rounded bg-sky-100/90 px-1 py-px text-[9px] font-medium leading-none text-sky-900/70">
                                        Manual
                                      </span>
                                    ) : null}
                                    <div className="flex w-full items-center justify-end gap-0.5">
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        disabled={confirmed}
                                        title={
                                          hasOverride
                                            ? "Importe manual para este mes"
                                            : "Automático (P. unit. × cant.); editá para fijar un importe distinto"
                                        }
                                        value={cellVal}
                                        onChange={(e) => {
                                          const n = Number(e.target.value);
                                          patchMonthCellOverride(r.id, c.key, Number.isFinite(n) ? n : 0);
                                        }}
                                        className={
                                          hasOverride
                                            ? "min-w-0 flex-1 rounded border border-sky-300/90 bg-white/90 px-1 py-1 text-right text-xs text-slate-900 disabled:bg-slate-50"
                                            : "min-w-0 flex-1 rounded border border-slate-300 px-1 py-1 text-right text-xs text-slate-900 disabled:bg-slate-50"
                                        }
                                      />
                                      {hasOverride && !confirmed ? (
                                        <button
                                          type="button"
                                          title="Volver al valor automático (P. unit. × cant.)"
                                          onClick={() => clearMonthCellOverride(r.id, c.key)}
                                          className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1 py-0.5 text-xs leading-none text-slate-700 hover:bg-slate-100"
                                        >
                                          ↺
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => deleteService(r.id)}
                              disabled={saving || confirmed}
                              className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td colSpan={5} className="px-2 py-2 font-semibold text-slate-800">
                        Total por mes
                      </td>
                      {cols.map((c) => (
                        <td key={c.key} className="px-2 py-2 text-right font-semibold tabular-nums">
                          {(byMonthTotal[c.key] || 0).toLocaleString("es-UY", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      ))}
                      <td />
                    </tr>
                    <tr className="border-t border-slate-200 bg-slate-50/80">
                      <td colSpan={5} className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Total general
                      </td>
                      <td colSpan={cols.length} className="px-2 py-2 text-right text-base font-bold tabular-nums text-slate-900">
                        {grandTotalPropuesta.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div id="leads87-services-confirm" className="scroll-mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <h3 className="text-sm font-semibold text-emerald-950">Avanzar en el flujo</h3>
            <p className="mt-1 text-xs text-emerald-900/85">
              Al confirmar se guarda la estructura de servicios y podés continuar con la propuesta comercial (Paso 5).
            </p>
            {confirmed ? (
              <p className="mt-3 text-sm font-medium text-emerald-800">Estructura confirmada — seguí en Propuesta comercial.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void confirmStructure()}
                  disabled={loading || confirming || rows.length === 0}
                  className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirming ? "Confirmando…" : "Confirmar estructura y avanzar a propuesta"}
                </button>
                {rows.length === 0 && !loading ? (
                  <p className="mt-2 text-xs text-slate-600">Agregá al menos un servicio para habilitar el avance.</p>
                ) : null}
              </>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Narrativa comercial base</h3>
              <p className="mt-2 text-sm text-slate-700">
                La propuesta combina diagnóstico, implementación y crecimiento continuo para pasar de acciones aisladas a un sistema comercial sostenible.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Fases de la propuesta</h3>
              {Object.entries(phaseRows).map(([phase, items]) => (
                <p key={phase} className="mt-2 text-sm text-slate-700">
                  <span className="font-medium">{phase}:</span> {items.length} servicio(s)
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

