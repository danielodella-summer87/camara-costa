"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { List, LayoutGrid, FileText, ExternalLink, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import type { LeadForLeadsOkMacro, LeadsOkDocuments } from "@/lib/crm/leadsOkMacroFlow";
import { getLeadMacroFlowDisplay, getLeadStage, type DerivedLeadStage } from "@/lib/crm/getLeadDerivedFlow";
import {
  countLeads87CommercialSummary,
  commercialSummaryBucketForDerivedStage,
  type Leads87CommercialSummaryBucket,
} from "@/lib/crm/leads87CommercialSummary";
import { calcularEstadoReal, isLeadActive } from "@/lib/leads/leadStatusPolicy";

type LeadOption = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  email: string | null;
  telefono?: string | null;
  website?: string | null;
  pipeline: string | null;
  empresas?: { nombre?: string | null } | null;
  objetivos?: string | null;
  audiencia?: string | null;
  tamano?: string | null;
  notas?: string | null;
  ai_report?: string | null;
  proposal_confirmed_at?: string | null;
  proposal_sent_at?: string | null;
  proposal_doc_url?: string | null;
  presentation_doc_url?: string | null;
  proposal_reviewed?: boolean | null;
  commercial_stage?: string | null;
  commercial_strategy_json?: unknown;
  strategy_approved_at?: string | null;
  /** Documentos comerciales por tipo (GET /api/admin/leads agrupa lead_documents). */
  flow_documents?: LeadsOkDocuments;
  score?: number | null;
  score_categoria?: string | null;
  comercial_id?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  initiative_kind?: string | null;
  project_description?: string | null;
  /** Etapa del flujo (persistida o espejo de pipeline vía API). */
  etapa_actual?: string | null;
  closed_at?: string | null;
  /** p. ej. `won` | `lost` cuando exista cierre explícito. */
  closed_result?: string | null;
};

function toMacroLead(l: LeadOption): LeadForLeadsOkMacro {
  return {
    nombre: l.nombre,
    contacto: l.contacto,
    telefono: l.telefono,
    email: l.email,
    website: l.website ?? null,
    objetivos: l.objetivos,
    audiencia: l.audiencia,
    tamano: l.tamano ?? null,
    notas: l.notas,
    pipeline: l.pipeline,
    proposal_confirmed_at: l.proposal_confirmed_at,
    proposal_sent_at: l.proposal_sent_at,
    proposal_doc_url: l.proposal_doc_url,
    presentation_doc_url: l.presentation_doc_url,
    proposal_reviewed: l.proposal_reviewed,
    commercial_stage: l.commercial_stage,
    commercial_strategy_json: l.commercial_strategy_json,
    strategy_approved_at: l.strategy_approved_at,
    ai_report: l.ai_report,
    empresas: l.empresas,
    instagram: l.instagram ?? null,
    facebook: l.facebook ?? null,
    initiative_kind: l.initiative_kind ?? null,
    project_description: l.project_description ?? null,
  };
}

function getLeadFlowSnapshot(l: LeadOption): {
  stage: DerivedLeadStage;
  progress: number;
  label: string;
  isFlowCompleted: boolean;
} {
  return getLeadMacroFlowDisplay(toMacroLead(l), l.flow_documents ?? null);
}

function commercialSummaryInputFromLead(l: LeadOption): {
  lead: ReturnType<typeof toMacroLead>;
  documents: LeadsOkDocuments | null;
} {
  return { lead: toMacroLead(l), documents: l.flow_documents ?? null };
}

function normPipeline(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasStr(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

const KANBAN_COLUMNS = ["Nuevo", "Contactado", "Investigación", "Diagnóstico", "Estrategia", "Servicios", "Propuesta", "Presentación", "Seguimiento"] as const;
const KANBAN_COLUMN_SET = new Set<string>(KANBAN_COLUMNS);
const NORM_TO_KANBAN_COLUMN: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  investigacion: "Investigación",
  diagnostico: "Diagnóstico",
  estrategia: "Estrategia",
  servicios: "Servicios",
  propuesta: "Propuesta",
  presentacion: "Presentación",
  seguimiento: "Seguimiento",
};

/**
 * Salud del listado: misma fuente que la columna «Etapa actual» (`getLeadFlowSnapshot` / macro LEADS87).
 * No usa pipeline CRM ni score_categoria para evitar “Nuevo” con etapa macro ya avanzada (p. ej. Diagnóstico).
 */
function getLeadSalud(l: LeadOption): { label: string; status: "ok" | "medio" | "bajo" | "nuevo" } {
  const hasNombreOrEmpresa = hasStr(l.empresas?.nombre) || hasStr(l.nombre);
  const hasAnyContact = hasStr(l.contacto) || hasStr(l.telefono) || hasStr(l.email);
  if (!hasNombreOrEmpresa || !hasAnyContact) return { label: "Bloqueado", status: "bajo" };

  const cierre = calcularEstadoReal(l);
  if (cierre === "Cerrado") return { label: "Ganado", status: "ok" };
  if (cierre === "Perdido") return { label: "Perdido", status: "bajo" };

  const { stage } = getLeadFlowSnapshot(l);
  switch (stage) {
    case "lead":
    case "investigacion":
      return { label: "Nuevo", status: "nuevo" };
    case "diagnostico":
    case "estrategia":
    case "servicios":
      return { label: "En curso", status: "medio" };
    case "propuesta":
    case "presentacion":
      return { label: "Avanzado", status: "medio" };
    case "cierre":
    case "completo":
      return { label: "Completo", status: "ok" };
    default:
      return { label: "Nuevo", status: "nuevo" };
  }
}

/**
 * Clasificación operativa para fondos de fila y “Salud del proceso” (no confundir con `calcularEstadoReal`).
 * No usa % avance ni etapa derivada “completo” del macro flow.
 */
type LeadProcesoVisual = "cerrado_ganado" | "cerrado_perdido" | "en_curso" | "nuevo" | "bloqueado";

function getLeadEstadoVisual(l: LeadOption): LeadProcesoVisual {
  const hasNombreOrEmpresa = hasStr(l.empresas?.nombre) || hasStr(l.nombre);
  const hasAnyContact = hasStr(l.contacto) || hasStr(l.telefono) || hasStr(l.email);
  if (!hasNombreOrEmpresa || !hasAnyContact) return "bloqueado";

  const cierre = calcularEstadoReal(l);
  if (cierre === "Cerrado") return "cerrado_ganado";
  if (cierre === "Perdido") return "cerrado_perdido";

  const { stage } = getLeadFlowSnapshot(l);
  if (stage === "lead" || stage === "investigacion") return "nuevo";
  return "en_curso";
}

type SaludCounts = {
  completo: number;
  perdido: number;
  activo: number;
  bloqueado: number;
  nuevo: number;
  total: number;
};

function computeSaludCounts(items: LeadOption[]): SaludCounts {
  let completo = 0;
  let perdido = 0;
  let activo = 0;
  let bloqueado = 0;
  let nuevo = 0;
  for (const l of items) {
    const e = getLeadEstadoVisual(l);
    if (e === "cerrado_ganado") completo++;
    else if (e === "cerrado_perdido") perdido++;
    else if (e === "en_curso") activo++;
    else if (e === "bloqueado") bloqueado++;
    else nuevo++;
  }
  return { completo, perdido, activo, bloqueado, nuevo, total: items.length };
}

type SaludAccionTipo = "bloqueado" | "activo" | "nuevo" | "completo" | "perdido";

function matchesSaludAccion(l: LeadOption, tipo: SaludAccionTipo): boolean {
  const e = getLeadEstadoVisual(l);
  if (tipo === "completo") return e === "cerrado_ganado";
  if (tipo === "perdido") return e === "cerrado_perdido";
  if (tipo === "activo") return e === "en_curso";
  if (tipo === "bloqueado") return e === "bloqueado";
  return e === "nuevo";
}

/** Una línea de insight con proporciones (no altera conteos). */
function saludInsightLine(c: SaludCounts): string | null {
  const { completo, perdido, activo, nuevo, total } = c;
  if (total === 0) return null;
  if (nuevo > activo && nuevo > 0) {
    return "Hay más leads nuevos que activos.";
  }
  const pA = Math.round((activo / total) * 100);
  const pC = Math.round((completo / total) * 100);
  const pP = Math.round((perdido / total) * 100);
  if (pA >= 45) return `El ${pA}% está en curso.`;
  if (pC <= 15 && total >= 4) return `Solo el ${pC}% está ganado.`;
  if (pC >= 40) return `El ${pC}% ya está ganado.`;
  if (pP >= 25 && total >= 4) return `El ${pP}% está en perdido.`;
  return null;
}

function SaludProcesoBlock({
  counts,
  variant,
  loading,
  onVerGrupo,
}: {
  counts: SaludCounts;
  variant: "global" | "filtered";
  loading: boolean;
  onVerGrupo: (tipo: SaludAccionTipo) => void;
}) {
  const { completo, perdido, activo, bloqueado, nuevo, total } = counts;
  const w = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const insight = saludInsightLine(counts);
  const wrap =
    variant === "global"
      ? "mt-2 rounded-lg border border-slate-200/70 bg-slate-50/50 px-3 py-2.5"
      : "mt-2 rounded-lg border border-slate-200/70 bg-slate-100/40 px-3 py-2.5";

  const m = Math.max(completo, perdido, activo, nuevo);
  const linkBtn =
    "ml-1 inline align-baseline text-xs font-semibold text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-slate-900";

  let primaryLine: ReactNode = null;
  let riskHighlight = false;

  if (total > 0) {
    if (bloqueado > 0) {
      riskHighlight = true;
      primaryLine = (
        <>
          <span className="text-base" aria-hidden>
            🔴
          </span>{" "}
          <span className="font-semibold text-red-900">
            {bloqueado === 1 ? "1 lead bloqueado" : `${bloqueado} leads bloqueados`}
          </span>
          {" — "}
          <button type="button" className={linkBtn + " text-red-900 decoration-red-300"} onClick={() => onVerGrupo("bloqueado")}>
            ver cuáles
          </button>
        </>
      );
    } else if (m === activo && activo > completo && activo > perdido && activo > nuevo) {
      primaryLine = (
        <>
          <span className="text-base" aria-hidden>
            🟡
          </span>{" "}
          <span className="font-medium text-slate-800">
            {activo === 1 ? "1 lead activo" : `${activo} leads activos`}
          </span>
          {" — "}
          <button type="button" className={linkBtn} onClick={() => onVerGrupo("activo")}>
            seguir avanzando
          </button>
        </>
      );
    } else if (m === nuevo && nuevo > activo && nuevo > completo && nuevo > perdido) {
      primaryLine = (
        <>
          <span className="text-base" aria-hidden>
            ⚪
          </span>{" "}
          <span className="font-medium text-slate-800">
            {nuevo === 1 ? "Hay 1 lead sin trabajar" : `Hay ${nuevo} leads sin trabajar`}
          </span>
          {" — "}
          <span className="text-slate-600">oportunidad directa</span>
          {" · "}
          <button type="button" className={linkBtn} onClick={() => onVerGrupo("nuevo")}>
            ver listado
          </button>
        </>
      );
    } else if (m === completo && completo > activo && completo > perdido && completo > nuevo && completo > 0) {
      primaryLine = (
        <>
          <span className="text-base" aria-hidden>
            🟢
          </span>{" "}
          <span className="font-medium text-slate-800">
            {completo === 1 ? "1 lead ganado" : `${completo} leads ganados`}
          </span>
          {" — "}
          <button type="button" className={linkBtn} onClick={() => onVerGrupo("completo")}>
            revisar cierres
          </button>
        </>
      );
    } else if (m === perdido && perdido > activo && perdido > completo && perdido > nuevo && perdido > 0) {
      primaryLine = (
        <>
          <span className="text-base" aria-hidden>
            📉
          </span>{" "}
          <span className="font-medium text-slate-800">
            {perdido === 1 ? "1 lead perdido" : `${perdido} leads perdidos`}
          </span>
          {" — "}
          <button type="button" className={linkBtn} onClick={() => onVerGrupo("perdido")}>
            ver listado
          </button>
        </>
      );
    } else {
      const fallback: SaludAccionTipo =
        activo >= nuevo && activo >= completo && activo >= perdido && activo > 0
          ? "activo"
          : nuevo > 0
            ? "nuevo"
            : completo > 0
              ? "completo"
              : perdido > 0
                ? "perdido"
                : "activo";
      primaryLine = (
        <>
          <span className="font-medium text-slate-700">Distribución equilibrada</span>
          {" — "}
          <button type="button" className={linkBtn} onClick={() => onVerGrupo(fallback)}>
            ver en listado
          </button>
        </>
      );
    }
  }

  return (
    <div className={wrap}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/60 pb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salud del proceso</h3>
        {variant === "filtered" && (
          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200/80">
            Vista filtrada
          </span>
        )}
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : total === 0 ? (
        <p className="text-xs text-slate-500">Sin leads en este universo.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => completo > 0 && onVerGrupo("completo")}
              disabled={completo === 0}
              className="inline-flex items-baseline gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-100 disabled:opacity-50"
              title="Ver ganados"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
              Ganado: <span className="tabular-nums">{completo}</span>
            </button>
            <button
              type="button"
              onClick={() => perdido > 0 && onVerGrupo("perdido")}
              disabled={perdido === 0}
              className="inline-flex items-baseline gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-900 ring-1 ring-rose-100 disabled:opacity-50"
              title="Ver perdidos"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
              Perdido: <span className="tabular-nums">{perdido}</span>
            </button>
            <button
              type="button"
              onClick={() => activo > 0 && onVerGrupo("activo")}
              disabled={activo === 0}
              className="inline-flex items-baseline gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 ring-1 ring-amber-100 disabled:opacity-50"
              title="Ver activos"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
              Activo: <span className="tabular-nums">{activo}</span>
            </button>
            <button
              type="button"
              onClick={() => bloqueado > 0 && onVerGrupo("bloqueado")}
              disabled={bloqueado === 0}
              className="inline-flex items-baseline gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-800 ring-1 ring-red-100 disabled:opacity-50"
              title="Ver bloqueados"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden />
              Bloqueado: <span className="tabular-nums">{bloqueado}</span>
            </button>
            <button
              type="button"
              onClick={() => nuevo > 0 && onVerGrupo("nuevo")}
              disabled={nuevo === 0}
              className="inline-flex items-baseline gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80 disabled:opacity-50"
              title="Ver sin trabajar"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
              Nuevo: <span className="tabular-nums">{nuevo}</span>
            </button>
          </div>
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 shadow-inner"
            role="img"
            aria-label={`Salud: ${completo} ganado, ${perdido} perdido, ${activo} activo, ${bloqueado} bloqueado, ${nuevo} nuevo`}
          >
            {completo > 0 && (
              <div className="h-full min-w-px shrink-0 bg-emerald-400/90" style={{ width: `${w(completo)}%` }} title={`Ganado: ${completo}`} />
            )}
            {perdido > 0 && (
              <div className="h-full min-w-px shrink-0 bg-rose-400/90" style={{ width: `${w(perdido)}%` }} title={`Perdido: ${perdido}`} />
            )}
            {activo > 0 && (
              <div className="h-full min-w-px shrink-0 bg-amber-300" style={{ width: `${w(activo)}%` }} title={`Activo: ${activo}`} />
            )}
            {bloqueado > 0 && (
              <div className="h-full min-w-px shrink-0 bg-red-400/90" style={{ width: `${w(bloqueado)}%` }} title={`Bloqueado: ${bloqueado}`} />
            )}
            {nuevo > 0 && (
              <div className="h-full min-w-px shrink-0 bg-slate-400/70" style={{ width: `${w(nuevo)}%` }} title={`Nuevo: ${nuevo}`} />
            )}
          </div>
          {primaryLine ? (
            <div
              className={
                riskHighlight
                  ? "rounded-lg border border-red-200/80 bg-red-50/90 px-2.5 py-2 shadow-sm"
                  : "rounded-lg border border-transparent bg-transparent px-0 py-0.5"
              }
            >
              <p className={`text-sm leading-snug ${riskHighlight ? "text-red-950" : "text-slate-700"}`}>{primaryLine}</p>
              {insight ? (
                <p className={`mt-1 text-xs leading-snug ${riskHighlight ? "text-red-800/90 font-medium" : "text-slate-500"}`}>{insight}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function leadLabel(l: LeadOption): string {
  const empresa = l.empresas?.nombre?.trim();
  const contacto = l.contacto?.trim();
  const email = l.email?.trim();
  const nombre = l.nombre?.trim();
  return empresa || contacto || email || nombre || "Sin nombre";
}

/** Siguiente acción recomendada para un lead (solo con datos del listado). */
function getNextAction(l: LeadOption): { action: string; href: string } {
  const { stage } = getLeadFlowSnapshot(l);
  const baseHref = `/admin/leads87/${encodeURIComponent(l.id)}`;
  switch (stage) {
    case "diagnostico":
      return { action: "Generar estrategia", href: baseHref };
    case "estrategia":
      return { action: "Definir servicios", href: baseHref };
    case "servicios":
      return { action: "Armar propuesta", href: baseHref };
    case "propuesta":
      return { action: "Preparar presentación", href: baseHref };
    case "presentacion":
      return { action: "Cerrar negocio", href: baseHref };
    default:
      return { action: "Continuar proceso", href: baseHref };
  }
}

function NextActionPanel({
  lead,
  loading,
  leadLabelFn,
}: {
  lead: LeadOption | null;
  loading: boolean;
  leadLabelFn: (l: LeadOption) => string;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-sm text-slate-500">Cargando siguiente acción…</p>
      </div>
    );
  }
  if (!lead) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-sm text-slate-500">No hay leads activos o bloqueados. Creá uno o elegí otro filtro.</p>
        <Link href="/admin/leads/nuevo" className="mt-2 inline-block text-sm font-medium text-slate-700 underline hover:text-slate-900">
          Nuevo lead
        </Link>
      </div>
    );
  }
  const proceso = getLeadEstadoVisual(lead);
  const estadoComercial = calcularEstadoReal(lead);
  const { action, href } = getNextAction(lead);
  const estadoLabel =
    proceso === "bloqueado"
      ? "Bloqueado"
      : estadoComercial === "Cerrado"
        ? "Cerrado"
        : estadoComercial === "Perdido"
          ? "Perdido"
          : "Activo";
  const estadoClass =
    proceso === "bloqueado"
      ? "bg-red-100 text-red-800"
      : estadoComercial === "Cerrado"
        ? "bg-emerald-100 text-emerald-800"
        : estadoComercial === "Perdido"
          ? "bg-rose-100 text-rose-900"
          : proceso === "en_curso"
            ? "bg-amber-100 text-amber-800"
            : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Siguiente acción</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate">{leadLabelFn(lead)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoClass}`}>{estadoLabel}</span>
            <span className="text-sm text-slate-600">{action}</span>
          </div>
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Continuar proceso
        </Link>
      </div>
    </div>
  );
}

type ViewMode = "kanban" | "listado";
const PIPELINE_FILTER_OPTIONS = ["Todos", ...KANBAN_COLUMNS];

const SALUD_URL_KEYS = ["bloqueado", "activo", "nuevo", "completo", "perdido"] as const;

const SEGMENTO_URL_KEYS = ["nuevas", "activas", "en_propuesta", "en_seguimiento"] as const;

function parseSegmentoDrill(sp: URLSearchParams): Leads87CommercialSummaryBucket | null {
  const s = sp.get("segmento");
  if (!s || !(SEGMENTO_URL_KEYS as readonly string[]).includes(s)) return null;
  return s as Leads87CommercialSummaryBucket;
}

function parseSaludDrill(sp: URLSearchParams): { tipo: SaludAccionTipo; scope: "global" | "vista" } | null {
  const s = sp.get("salud");
  if (!s || !(SALUD_URL_KEYS as readonly string[]).includes(s)) return null;
  return {
    tipo: s as SaludAccionTipo,
    scope: sp.get("alcance") === "global" ? "global" : "vista",
  };
}

/** Compara queries ignorando orden de params (evita replace en bucle). */
function canonicalQueryString(sp: URLSearchParams): string {
  return [...sp.entries()]
    .sort(([ka, va], [kb, vb]) => (ka === kb ? va.localeCompare(vb) : ka.localeCompare(kb)))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

function shouldNavigateQuery(next: URLSearchParams, current: URLSearchParams): boolean {
  return canonicalQueryString(next) !== canonicalQueryString(current);
}

/** all | mine | comercial_id */
type ComercialFilterValue = "all" | "mine" | string;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseComercialFilterFromUrl(sp: URLSearchParams): ComercialFilterValue {
  const raw = (sp.get("comercial") ?? "").trim();
  const lower = raw.toLowerCase();
  if (!raw || lower === "all" || lower === "todos" || lower === "*") {
    const mineLegacy = (sp.get("mine") ?? "").trim().toLowerCase();
    if (mineLegacy === "1" || mineLegacy === "true") return "mine";
    return "all";
  }
  if (lower === "mine") return "mine";
  if (UUID_RE.test(raw)) return raw;
  return "all";
}

function comercialParamForUrl(v: ComercialFilterValue): string {
  if (v === "all") return "all";
  if (v === "mine") return "mine";
  return v;
}

export default function Leads87Page() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [leadsLoadError, setLeadsLoadError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = (searchParams.get("view") ?? "").trim().toLowerCase();
    return v === "kanban" ? "kanban" : "listado";
  });
  const [selectedPipeline, setSelectedPipeline] = useState(() => {
    const p = (searchParams.get("pipeline") ?? "").trim();
    if (!p || p.toLowerCase() === "todos") return "Todos";
    const normalized = normPipeline(p);
    const found = KANBAN_COLUMNS.find((c) => normPipeline(c) === normalized);
    return found ?? "Todos";
  });
  const [searchText, setSearchText] = useState(() => (searchParams.get("search") ?? "").trim());
  /** comercial_id del usuario actual (desde /api/admin/permissions/me). "Mi cartera" lo usa. */
  const [currentUserComercialId, setCurrentUserComercialId] = useState<string | null>(null);
  const [comercialesCatalog, setComercialesCatalog] = useState<{ id: string; nombre: string }[]>([]);
  const [dragError, setDragError] = useState<string | null>(null);
  /** Mensaje breve tras volver del detalle (p. ej. lead eliminado). */
  const [listFlash, setListFlash] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  /** Primitivo estable: useSearchParams() cambia de referencia cada render y dispara efectos en bucle si se usa como dependencia. */
  const searchParamsKey = searchParams.toString();
  const comercialFilter = useMemo(
    () => parseComercialFilterFromUrl(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );
  const filterSnapshot = useRef({
    pipeline: selectedPipeline,
    search: searchText,
    comercial: comercialFilter,
  });

  useEffect(() => {
    let cancelled = false;
    setLoadingLeads(true);
    setLeadsLoadError(null);
    fetch("/api/admin/leads", { cache: "no-store", headers: { "Cache-Control": "no-store" } })
      .then(async (res) => {
        const json = (await res.json()) as { data?: LeadOption[] | null; error?: string | null };
        if (!res.ok) throw new Error(json?.error ?? "Error cargando leads");
        if (json?.error) throw new Error(json.error);
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        const data = Array.isArray(json?.data) ? json.data : [];
        const active = data.filter((l) => l?.id && isLeadActive(l.pipeline));
        setLeads(active);
        setLeadsLoadError(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setLeads([]);
          setLeadsLoadError(e instanceof Error ? e.message : "No se pudieron cargar los leads.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLeads(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("leads87_list_flash");
      if (msg) {
        setListFlash(msg);
        sessionStorage.removeItem("leads87_list_flash");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/permissions/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { user?: { comercial_id?: string | null } }) => {
        const cid = j?.user?.comercial_id ?? null;
        setCurrentUserComercialId(typeof cid === "string" && cid.trim() ? cid.trim() : null);
      })
      .catch(() => setCurrentUserComercialId(null));
  }, []);

  useEffect(() => {
    fetch("/api/admin/comerciales", { cache: "no-store", headers: { "Cache-Control": "no-store" } })
      .then((r) => r.json())
      .then((j: { data?: { id?: string; nombre?: string | null }[] }) => {
        const arr = Array.isArray(j?.data) ? j.data : [];
        setComercialesCatalog(
          arr
            .filter((c) => c?.id && typeof c.id === "string")
            .map((c) => ({ id: c.id as string, nombre: (c.nombre && String(c.nombre).trim()) || "Sin nombre" })),
        );
      })
      .catch(() => setComercialesCatalog([]));
  }, []);

  useEffect(() => {
    const prev = filterSnapshot.current;
    const filtersChanged =
      prev.pipeline !== selectedPipeline ||
      prev.search !== searchText ||
      prev.comercial !== comercialFilter;
    filterSnapshot.current = { pipeline: selectedPipeline, search: searchText, comercial: comercialFilter };

    const params = new URLSearchParams();
    params.set("view", viewMode);
    if (selectedPipeline && selectedPipeline !== "Todos") params.set("pipeline", selectedPipeline);
    if (searchText.trim()) params.set("search", searchText.trim());
    params.set("comercial", comercialParamForUrl(comercialFilter));

    const drill = parseSaludDrill(new URLSearchParams(searchParamsKey));
    if (drill && !filtersChanged) {
      params.set("salud", drill.tipo);
      if (drill.scope === "global") params.set("alcance", "global");
    }

    const seg = parseSegmentoDrill(new URLSearchParams(searchParamsKey));
    if (seg && !filtersChanged) {
      params.set("segmento", seg);
    }

    const currentSp = new URLSearchParams(searchParamsKey);
    if (!shouldNavigateQuery(params, currentSp)) return;

    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [viewMode, selectedPipeline, searchText, comercialFilter, searchParamsKey, pathname, router]);

  const navigateComercialFilter = (next: ComercialFilterValue) => {
    const p = new URLSearchParams();
    p.set("view", viewMode);
    if (selectedPipeline !== "Todos") p.set("pipeline", selectedPipeline);
    if (searchText.trim()) p.set("search", searchText.trim());
    p.set("comercial", comercialParamForUrl(next));
    const currentSp = new URLSearchParams(searchParams.toString());
    if (shouldNavigateQuery(p, currentSp)) {
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  };

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (selectedPipeline !== "Todos") {
      const targetNorm = normPipeline(selectedPipeline);
      list = list.filter((l) => normPipeline(l.pipeline) === targetNorm);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter((l) => {
        const empresa = (l.empresas?.nombre ?? l.nombre ?? "").toLowerCase();
        const contacto = (l.contacto ?? "").toLowerCase();
        const email = (l.email ?? "").toLowerCase();
        return empresa.includes(q) || contacto.includes(q) || email.includes(q);
      });
    }
    if (comercialFilter === "mine" && currentUserComercialId) {
      list = list.filter((l) => (l.comercial_id ?? null) === currentUserComercialId);
    } else if (comercialFilter !== "all" && comercialFilter !== "mine") {
      list = list.filter((l) => String(l.comercial_id ?? "").trim() === comercialFilter);
    }
    return list;
  }, [leads, selectedPipeline, searchText, comercialFilter, currentUserComercialId]);

  const saludDrill = useMemo(() => parseSaludDrill(searchParams), [searchParams]);
  const segmentoDrill = useMemo(() => parseSegmentoDrill(searchParams), [searchParams]);

  const displayLeads = useMemo(() => {
    if (saludDrill) {
      const base = saludDrill.scope === "global" ? leads : filteredLeads;
      return base.filter((l) => matchesSaludAccion(l, saludDrill.tipo));
    }
    if (segmentoDrill) {
      return filteredLeads.filter((l) => {
        const stage = getLeadStage(toMacroLead(l), l.flow_documents ?? null);
        return commercialSummaryBucketForDerivedStage(stage) === segmentoDrill;
      });
    }
    return filteredLeads;
  }, [leads, filteredLeads, saludDrill, segmentoDrill]);

  const handleSaludVerGrupo = (tipo: SaludAccionTipo, scope: "global" | "vista") => {
    setViewMode("listado");
    const p = new URLSearchParams();
    p.set("view", "listado");
    if (selectedPipeline !== "Todos") p.set("pipeline", selectedPipeline);
    if (searchText.trim()) p.set("search", searchText.trim());
    p.set("comercial", comercialParamForUrl(comercialFilter));
    p.set("salud", tipo);
    if (scope === "global") p.set("alcance", "global");
    const currentSp = new URLSearchParams(searchParams.toString());
    if (shouldNavigateQuery(p, currentSp)) {
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
    requestAnimationFrame(() => {
      document.getElementById("leads87-tabla")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSegmentoVerGrupo = (bucket: Leads87CommercialSummaryBucket) => {
    setViewMode("listado");
    const p = new URLSearchParams();
    p.set("view", "listado");
    if (selectedPipeline !== "Todos") p.set("pipeline", selectedPipeline);
    if (searchText.trim()) p.set("search", searchText.trim());
    p.set("comercial", comercialParamForUrl(comercialFilter));
    p.set("segmento", bucket);
    const currentSp = new URLSearchParams(searchParams.toString());
    if (shouldNavigateQuery(p, currentSp)) {
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
    requestAnimationFrame(() => {
      document.getElementById("leads87-tabla")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSaludVerTodos = () => {
    const p = new URLSearchParams();
    p.set("view", viewMode);
    if (selectedPipeline !== "Todos") p.set("pipeline", selectedPipeline);
    if (searchText.trim()) p.set("search", searchText.trim());
    p.set("comercial", comercialParamForUrl(comercialFilter));
    const q = p.toString();
    const nextSp = new URLSearchParams(q);
    const currentSp = new URLSearchParams(searchParams.toString());
    if (shouldNavigateQuery(nextSp, currentSp)) {
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  };

  const saludDrillLabels: Record<SaludAccionTipo, string> = {
    bloqueado: "bloqueados (faltan datos)",
    activo: "activos en curso",
    nuevo: "sin trabajar",
    completo: "ganados",
    perdido: "perdidos",
  };

  const segmentoDrillLabels: Record<Leads87CommercialSummaryBucket, string> = {
    nuevas: "en etapa Lead (datos base / sin avanzar el flujo)",
    activas: "en investigación, diagnóstico, estrategia o servicios",
    en_propuesta: "en propuesta o presentación",
    en_seguimiento: "en cierre o proceso completo",
  };

  const comercialSelectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of comercialesCatalog) {
      if (c.id) map.set(c.id, c.nombre || "Sin nombre");
    }
    for (const l of leads) {
      const id = l.comercial_id?.trim();
      if (id && !map.has(id)) {
        map.set(id, `Comercial (${id.length > 8 ? `${id.slice(0, 8)}…` : id})`);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [comercialesCatalog, leads]);

  /** Conteos por etapa derivada del flujo LEADS87 (getLeadStage); la columna «Etapa actual» usa el mismo snapshot macro que la ficha (getLeadMacroFlowDisplay → label). */
  const globalCommercialSummary = useMemo(
    () => countLeads87CommercialSummary(leads.map(commercialSummaryInputFromLead)),
    [leads],
  );

  const filteredCommercialSummary = useMemo(
    () => countLeads87CommercialSummary(filteredLeads.map(commercialSummaryInputFromLead)),
    [filteredLeads],
  );

  const globalSaludCounts = useMemo(() => computeSaludCounts(leads), [leads]);
  const filteredSaludCounts = useMemo(() => computeSaludCounts(filteredLeads), [filteredLeads]);

  const leadsByColumn = useMemo(() => {
    const map: Record<string, LeadOption[]> = {};
    KANBAN_COLUMNS.forEach((col) => {
      map[col] = [];
    });
    map["Otros"] = [];
    for (const l of displayLeads) {
      const key = NORM_TO_KANBAN_COLUMN[normPipeline(l.pipeline)] ?? "Otros";
      if (!map[key]) map[key] = [];
      map[key].push(l);
    }
    return map;
  }, [displayLeads]);

  /** Lead prioritario: primero bloqueado, sino primero en curso, sino primero nuevo. */
  const priorityLead = useMemo(() => {
    const bloqueado = displayLeads.find((l) => getLeadEstadoVisual(l) === "bloqueado");
    if (bloqueado) return bloqueado;
    const enCurso = displayLeads.find((l) => getLeadEstadoVisual(l) === "en_curso");
    if (enCurso) return enCurso;
    const nuevo = displayLeads.find((l) => getLeadEstadoVisual(l) === "nuevo");
    if (nuevo) return nuevo;
    return displayLeads[0] ?? null;
  }, [displayLeads]);

  const [showMetricsSection, setShowMetricsSection] = useState(false);

  const handleOpen = () => {
    if (!selectedLeadId?.trim()) return;
    router.push(`/admin/leads87/${encodeURIComponent(selectedLeadId)}`);
  };

  const handleKanbanDragStart = (e: React.DragEvent, leadId: string, sourcePipeline: string | null) => {
    if (savingLeadId === leadId) {
      e.preventDefault();
      return;
    }
    setDragError(null);
    setDraggingLeadId(leadId);
    e.dataTransfer.setData("application/json", JSON.stringify({ leadId, sourcePipeline }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleKanbanDragEnd = () => {
    setDraggingLeadId(null);
    setDragOverColumn(null);
  };

  const handleKanbanDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(col);
  };

  const handleKanbanDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleKanbanDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggingLeadId(null);

    if (!KANBAN_COLUMN_SET.has(targetColumn)) return;

    let data: { leadId: string; sourcePipeline: string | null };
    try {
      data = JSON.parse(e.dataTransfer.getData("application/json"));
    } catch {
      return;
    }
    const { leadId } = data;
    if (!leadId) return;
    if (savingLeadId === leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (normPipeline(lead.pipeline) === normPipeline(targetColumn)) return;

    const previousLeads = leads.slice();
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipeline: targetColumn } : l)));
    setSavingLeadId(leadId);

    try {
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ pipeline: targetColumn }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setLeads(previousLeads);
        setDragError("No se pudo actualizar la etapa. Reintentá.");
      } else {
        setDragError(null);
      }
    } catch {
      setLeads(previousLeads);
      setDragError("No se pudo actualizar la etapa. Reintentá.");
    } finally {
      setSavingLeadId(null);
    }
  };

  return (
    <PageContainer>
      {listFlash ? (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900"
          role="status"
        >
          <span>{listFlash}</span>
          <button
            type="button"
            onClick={() => setListFlash(null)}
            className="shrink-0 font-medium text-emerald-800 underline decoration-emerald-600/60 hover:text-emerald-950"
          >
            Cerrar
          </button>
        </div>
      ) : null}
      {leadsLoadError ? (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          <p className="font-semibold">No se pudo cargar el listado de leads</p>
          <p className="mt-1 text-red-800">{leadsLoadError}</p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">LEADS87</h1>
        <p className="mt-1 text-sm text-slate-600">
          Versión definitiva del sistema comercial. Flujo único: Lead → Investigación → Diagnóstico → Estrategia → Servicios → Propuesta → Presentación → Cierre.
        </p>

        {/* Selector Lista | Kanban | Ficha (Ficha = detalle LEADS87) */}
        <div className="mt-4 flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
          {[
            { id: "lista" as const, label: "Lista", Icon: List, href: "/admin/leads" },
            { id: "kanban" as const, label: "Kanban", Icon: LayoutGrid, href: "/admin/leads/kanban" },
            { id: "ficha" as const, label: "LEADS87", Icon: FileText, href: "/admin/leads87" },
          ].map(({ id, label, Icon, href }) => {
            const isActive =
              (id === "ficha" && pathname?.startsWith("/admin/leads87")) ||
              (id === "lista" && pathname === "/admin/leads") ||
              (id === "kanban" && pathname === "/admin/leads/kanban");
            return (
              <Link
                key={id}
                href={href}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-slate-100/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4">
          <Link
            href="/admin/neuroventas"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            Manual de neuroventas
          </Link>
        </div>
      </div>

      {/* Siguiente acción (foco operativo) */}
      <div className="mt-6">
        <NextActionPanel lead={priorityLead} loading={loadingLeads} leadLabelFn={leadLabel} />
      </div>

      {/* Abrir oportunidad LEADS87 */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Abrir oportunidad (LEADS87)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            disabled={loadingLeads}
            className="min-w-[240px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">
              {loadingLeads ? "Cargando leads…" : "Seleccioná un lead activo"}
            </option>
            {displayLeads.map((l) => (
              <option key={l.id} value={l.id}>
                {leadLabel(l)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleOpen}
            disabled={!selectedLeadId?.trim()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            Abrir en LEADS87
          </button>
        </div>
      </div>

      {/* Métricas y salud del proceso (colapsado por defecto) */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMetricsSection((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <span>Métricas globales y resultado actual</span>
          {showMetricsSection ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          )}
        </button>
        {showMetricsSection && (
          <div className="border-t border-slate-200 p-4">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-stretch">
              <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm xl:h-full">
                <p className="mb-1.5 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-600">Métricas globales</p>
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nuevas</p>
                    <p className="mt-0.5 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : globalCommercialSummary.nuevas}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Activas</p>
                    <p className="mt-0.5 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : globalCommercialSummary.activas}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En propuesta</p>
                    <p className="mt-0.5 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : globalCommercialSummary.en_propuesta}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En seguimiento</p>
                    <p className="mt-0.5 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : globalCommercialSummary.en_seguimiento}</p>
                  </div>
                </div>
                <div className="min-h-0 flex flex-1 flex-col">
                  <SaludProcesoBlock
                    counts={globalSaludCounts}
                    variant="global"
                    loading={loadingLeads}
                    onVerGrupo={(t) => handleSaludVerGrupo(t, "global")}
                  />
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm xl:h-full">
                <p className="mb-1.5 flex shrink-0 flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vista filtrada
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium normal-case text-slate-600">Resultado actual</span>
                </p>
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nuevas</p>
                    <p className="mt-0.5 text-xl font-semibold text-slate-700">{loadingLeads ? "—" : filteredCommercialSummary.nuevas}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Activas</p>
                    <p className="mt-0.5 text-xl font-semibold text-slate-700">{loadingLeads ? "—" : filteredCommercialSummary.activas}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En propuesta</p>
                    <p className="mt-0.5 text-xl font-semibold text-slate-700">{loadingLeads ? "—" : filteredCommercialSummary.en_propuesta}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En seguimiento</p>
                    <p className="mt-0.5 text-xl font-semibold text-slate-700">{loadingLeads ? "—" : filteredCommercialSummary.en_seguimiento}</p>
                  </div>
                </div>
                <div className="min-h-0 flex flex-1 flex-col">
                  <SaludProcesoBlock
                    counts={filteredSaludCounts}
                    variant="filtered"
                    loading={loadingLeads}
                    onVerGrupo={(t) => handleSaludVerGrupo(t, "vista")}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vista Listado / Kanban */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={() => setViewMode("listado")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${viewMode === "listado" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
        >
          Listado
        </button>
        <button
          type="button"
          onClick={() => setViewMode("kanban")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${viewMode === "kanban" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
        >
          Kanban
        </button>
        <Link
          href="/admin/leads/nuevo"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Nuevo lead
        </Link>
      </div>

      {/* Resumen por etapa derivada (misma lógica que «Etapa actual» / getLeadStage) */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { key: "nuevas" as const, label: "Nuevas" },
            { key: "activas" as const, label: "Activas" },
            { key: "en_propuesta" as const, label: "En propuesta" },
            { key: "en_seguimiento" as const, label: "En seguimiento" },
          ] as const
        ).map(({ key, label }) => {
          const value =
            key === "nuevas"
              ? filteredCommercialSummary.nuevas
              : key === "activas"
                ? filteredCommercialSummary.activas
                : key === "en_propuesta"
                  ? filteredCommercialSummary.en_propuesta
                  : filteredCommercialSummary.en_seguimiento;
          const selected = segmentoDrill === key;
          return (
            <button
              key={key}
              type="button"
              disabled={loadingLeads || value === 0}
              onClick={() => handleSegmentoVerGrupo(key)}
              title="Ver en listado con este filtro de etapa"
              className={`rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50/80 disabled:cursor-default disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-white ${
                selected ? "border-slate-800 ring-2 ring-slate-800/15" : "border-slate-200"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-800 tabular-nums">{loadingLeads ? "—" : value}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Según etapa comercial derivada del flujo LEADS87 (no solo la columna del kanban). Total activos en cartera:{" "}
        <span className="font-medium text-slate-700 tabular-nums">{loadingLeads ? "—" : filteredCommercialSummary.total}</span>.
      </p>

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Pipeline</label>
          <select
            value={selectedPipeline}
            onChange={(e) => setSelectedPipeline(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            {PIPELINE_FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar lead, organización, contacto o email"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex min-w-[180px] flex-col gap-1 sm:min-w-[220px]">
          <label htmlFor="leads87-comercial" className="text-xs font-medium text-slate-600">
            Comercial
          </label>
          <select
            id="leads87-comercial"
            value={comercialFilter === "all" ? "all" : comercialFilter === "mine" ? "mine" : comercialFilter}
            onChange={(e) => {
              const v = e.target.value;
              navigateComercialFilter(v === "all" ? "all" : v === "mine" ? "mine" : v);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="all">Todos</option>
            <option value="mine" disabled={!currentUserComercialId} title={!currentUserComercialId ? "Sin comercial asignado a tu usuario" : undefined}>
              Mi cartera
            </option>
            {comercialFilter !== "all" &&
              comercialFilter !== "mine" &&
              !comercialSelectOptions.some(([id]) => id === comercialFilter) && (
                <option value={comercialFilter}>
                  Comercial ({comercialFilter.length > 10 ? `${comercialFilter.slice(0, 8)}…` : comercialFilter})
                </option>
              )}
            {comercialSelectOptions.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {saludDrill && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-700">
            Mostrando solo leads <strong className="font-semibold text-slate-900">{saludDrillLabels[saludDrill.tipo]}</strong>
            {saludDrill.scope === "global" ? (
              <span className="text-slate-500"> · alcance global</span>
            ) : (
              <span className="text-slate-500"> · según filtros actuales</span>
            )}
          </span>
          <button
            type="button"
            onClick={handleSaludVerTodos}
            className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Ver todos
          </button>
        </div>
      )}

      {segmentoDrill && !saludDrill && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-700">
            Filtrado por resumen comercial:{" "}
            <strong className="font-semibold text-slate-900">{segmentoDrillLabels[segmentoDrill]}</strong>
            <span className="text-slate-500"> · según filtros actuales</span>
          </span>
          <button
            type="button"
            onClick={handleSaludVerTodos}
            className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Ver todos
          </button>
        </div>
      )}

      {/* Contenido */}
      <div id="leads87-tabla" className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden scroll-mt-4">
        {viewMode === "listado" && (
          <>
            {loadingLeads ? (
              <div className="p-8 text-sm text-slate-600">Cargando oportunidades…</div>
            ) : leadsLoadError ? (
              <div className="p-8 text-sm text-slate-600">Revisá el mensaje de error arriba o recargá la página.</div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-sm text-slate-600">Ninguna oportunidad coincide con los filtros.</div>
            ) : displayLeads.length === 0 ? (
              <div className="p-8 text-sm text-slate-600">
                Ningún lead en este grupo con los filtros actuales. Probá &quot;Ver todos&quot; o otro segmento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                      <th scope="col" className="px-4 py-3">Organización / Lead</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Salud</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">% avance</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Etapa actual</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Estado</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {displayLeads.map((l) => {
                      const { progress, label: etapa } = getLeadFlowSnapshot(l);
                      const salud = getLeadSalud(l);
                      const proceso = getLeadEstadoVisual(l);
                      const estadoComercial = calcularEstadoReal(l);
                      const rowBg =
                        proceso === "cerrado_ganado"
                          ? "bg-emerald-50/50"
                          : proceso === "cerrado_perdido"
                            ? "bg-rose-50/40"
                            : proceso === "en_curso"
                              ? "bg-amber-50/30"
                              : proceso === "bloqueado"
                                ? "bg-red-50/30"
                                : "bg-slate-50/20";
                      const estadoLabel =
                        proceso === "bloqueado"
                          ? "Bloqueado"
                          : estadoComercial === "Cerrado"
                            ? "Cerrado"
                            : estadoComercial === "Perdido"
                              ? "Perdido"
                              : "Activo";
                      const estadoBadgeClass =
                        proceso === "bloqueado"
                          ? "bg-red-100 text-red-800"
                          : estadoComercial === "Cerrado"
                            ? "bg-emerald-100 text-emerald-800"
                            : estadoComercial === "Perdido"
                              ? "bg-rose-100 text-rose-900"
                              : proceso === "en_curso"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-200 text-slate-700";
                      const saludBadgeClass =
                        salud.status === "ok"
                          ? "bg-emerald-100 text-emerald-700"
                          : salud.status === "medio"
                            ? "bg-amber-100 text-amber-700"
                            : salud.status === "bajo"
                              ? "bg-slate-200 text-slate-600"
                              : "bg-slate-100 text-slate-600";
                      return (
                        <tr key={l.id} className={`hover:bg-slate-50/80 transition-colors ${rowBg}`}>
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/leads87/${encodeURIComponent(l.id)}`}
                              className="font-medium text-slate-800 hover:text-slate-900 hover:underline"
                            >
                              {leadLabel(l)}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${saludBadgeClass}`}>
                              {salud.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium tabular-nums text-slate-700">
                            {progress}%
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{etapa}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estadoBadgeClass}`}>
                              {estadoLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/admin/leads87/${encodeURIComponent(l.id)}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              Abrir
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {viewMode === "kanban" && (
          <>
            {loadingLeads ? (
              <div className="p-8 text-sm text-slate-600">Cargando oportunidades…</div>
            ) : leadsLoadError ? (
              <div className="p-8 text-sm text-slate-600">Revisá el mensaje de error arriba o recargá la página.</div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-sm text-slate-600">Ninguna oportunidad coincide con los filtros.</div>
            ) : displayLeads.length === 0 ? (
              <div className="p-8 text-sm text-slate-600">
                Ningún lead en este grupo. Usá &quot;Ver todos&quot; para ver el tablero completo.
              </div>
            ) : (
              <>
                {dragError && (
                  <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                    {dragError}
                  </div>
                )}
                <div className="flex gap-4 overflow-x-auto p-4 min-h-[320px] select-none">
                  {KANBAN_COLUMNS.map((col) => {
                    const columnLeads = leadsByColumn[col] ?? [];
                    const isDropTarget = draggingLeadId !== null && dragOverColumn === col;
                    return (
                      <div
                        key={col}
                        className={`flex-shrink-0 w-[280px] rounded-lg border select-none transition-colors ${
                          isDropTarget
                            ? "border-slate-400 bg-slate-100/90 ring-2 ring-slate-300 ring-offset-1"
                            : "border-slate-200 bg-slate-50/80"
                        }`}
                        onDragOver={(e) => handleKanbanDragOver(e, col)}
                        onDragLeave={handleKanbanDragLeave}
                        onDrop={(e) => handleKanbanDrop(e, col)}
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 select-none">
                          <h3 className="text-sm font-semibold text-slate-800 select-none">{col}</h3>
                          <span className="text-xs text-slate-500 select-none">{columnLeads.length}</span>
                        </div>
                        <div className="p-2 space-y-2 overflow-y-auto max-h-[70vh] select-none">
                          {columnLeads.map((l) => {
                            const { progress, label: etapa } = getLeadFlowSnapshot(l);
                            const salud = getLeadSalud(l);
                            const saludBadgeClass =
                              salud.status === "ok"
                                ? "bg-emerald-100 text-emerald-700"
                                : salud.status === "medio"
                                  ? "bg-amber-100 text-amber-700"
                                  : salud.status === "bajo"
                                    ? "bg-slate-200 text-slate-600"
                                    : "bg-slate-100 text-slate-600";
                            return (
                              <div
                                key={l.id}
                                draggable={savingLeadId !== l.id}
                                onDragStart={(e) => handleKanbanDragStart(e, l.id, l.pipeline)}
                                onDragEnd={handleKanbanDragEnd}
                                className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm select-none ${
                                  savingLeadId === l.id ? "cursor-wait opacity-70" : "cursor-grab active:cursor-grabbing"
                                } ${draggingLeadId === l.id ? "opacity-60" : ""}`}
                              >
                                <p className="text-sm font-medium text-slate-800 truncate select-none" title={leadLabel(l)}>
                                  {leadLabel(l)}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${saludBadgeClass}`}>
                                    {salud.label}
                                  </span>
                                  <span className="text-xs tabular-nums text-slate-600">{progress}%</span>
                                  <span className="text-xs text-slate-500 truncate" title={etapa}>{etapa}</span>
                                </div>
                                <Link
                                  href={`/admin/leads87/${encodeURIComponent(l.id)}`}
                                  draggable={false}
                                  className="mt-2 inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 select-none"
                                >
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                  Abrir en LEADS87
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {(leadsByColumn["Otros"]?.length ?? 0) > 0 && (
                    <div className="flex-shrink-0 w-[280px] rounded-lg border border-slate-200 bg-slate-50/80 select-none">
                      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 select-none">
                        <h3 className="text-sm font-semibold text-slate-500 select-none">Otros</h3>
                        <span className="text-xs text-slate-500 select-none">{leadsByColumn["Otros"].length}</span>
                      </div>
                      <div className="p-2 space-y-2 overflow-y-auto max-h-[70vh] select-none">
                        {(leadsByColumn["Otros"] ?? []).map((l) => {
                          const { progress, label: etapa } = getLeadFlowSnapshot(l);
                          const salud = getLeadSalud(l);
                          const saludBadgeClass =
                            salud.status === "ok"
                              ? "bg-emerald-100 text-emerald-700"
                              : salud.status === "medio"
                                ? "bg-amber-100 text-amber-700"
                                : salud.status === "bajo"
                                  ? "bg-slate-200 text-slate-600"
                                  : "bg-slate-100 text-slate-600";
                          return (
                            <div
                              key={l.id}
                              draggable={savingLeadId !== l.id}
                              onDragStart={(e) => handleKanbanDragStart(e, l.id, l.pipeline)}
                              onDragEnd={handleKanbanDragEnd}
                              className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm select-none ${
                                savingLeadId === l.id ? "cursor-wait opacity-70" : "cursor-grab active:cursor-grabbing"
                              } ${draggingLeadId === l.id ? "opacity-60" : ""}`}
                            >
                              <p className="text-sm font-medium text-slate-800 truncate select-none" title={leadLabel(l)}>
                                {leadLabel(l)}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${saludBadgeClass}`}>
                                  {salud.label}
                                </span>
                                <span className="text-xs tabular-nums text-slate-600">{progress}%</span>
                                <span className="text-xs text-slate-500 truncate" title={etapa}>{etapa}</span>
                              </div>
                              <Link
                                href={`/admin/leads87/${encodeURIComponent(l.id)}`}
                                draggable={false}
                                className="mt-2 inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 select-none"
                              >
                                <ExternalLink className="h-3 w-3" aria-hidden />
                                Abrir en LEADS87
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
