"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { List, LayoutGrid, FileText, ExternalLink } from "lucide-react";

type LeadOption = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  email: string | null;
  telefono?: string | null;
  pipeline: string | null;
  empresas?: { nombre?: string | null } | null;
  /** Campos opcionales que la API de listado puede devolver (sin tocar backend). */
  objetivos?: string | null;
  audiencia?: string | null;
  notas?: string | null;
  ai_report?: string | null;
  proposal_confirmed_at?: string | null;
  proposal_sent_at?: string | null;
  score?: number | null;
  score_categoria?: string | null;
  /** Responsable asignado (filtro por comercial en LEADS87). */
  comercial_id?: string | null;
};

const CLOSED_PIPELINES = new Set(["ganado", "perdido", "cerrado", "no interesado"]);

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

/** Progreso 0–100 usando misma lógica conceptual que el detalle (con los datos disponibles en listado). */
function getLeadProgressPercent(l: LeadOption): number {
  const hasNombreOrEmpresa = hasStr(l.empresas?.nombre) || hasStr(l.nombre);
  const hasContact = hasStr(l.contacto) || hasStr(l.telefono) || hasStr(l.email);
  const hasContext = hasStr(l.objetivos) || hasStr(l.audiencia) || hasStr(l.notas);
  const etapa1Done = hasNombreOrEmpresa && hasContact && (hasStr(l.objetivos) || hasStr(l.audiencia) || hasContext);
  const etapa2Done = hasStr(l.ai_report);
  const etapa5Done = Boolean(l.proposal_confirmed_at);
  const etapa8Done = Boolean(l.proposal_sent_at);
  const completed = [
    etapa1Done,
    etapa2Done,
    false,
    false,
    etapa5Done,
    false,
    false,
    etapa8Done,
  ];
  let activeIndex = completed.findIndex((c) => !c);
  if (activeIndex === -1) activeIndex = 8;
  const raw = Math.round((activeIndex / 8) * 100);
  if (raw >= 100) return 100;
  if (raw >= 75) return 75;
  if (raw >= 50) return 50;
  if (raw >= 25) return 25;
  return 0;
}

/** Nombre de etapa actual para mostrar (derivado del avance calculado). */
function getEtapaActualLabel(l: LeadOption): string {
  const progress = getLeadProgressPercent(l);
  if (progress >= 100) return "Cierre";
  if (progress >= 75) return "Presentación";
  if (progress >= 50) return "Servicios";
  if (progress >= 25) return "Investigación";
  return "Lead";
}

/** Salud del lead: texto breve y coherente (reutiliza score_categoria si existe). */
function getLeadSalud(l: LeadOption): { label: string; status: "ok" | "medio" | "bajo" | "nuevo" } {
  if (l.score_categoria && hasStr(l.score_categoria)) {
    const c = (l.score_categoria as string).toLowerCase();
    if (c.includes("listo") || c.includes("alto")) return { label: "Listo", status: "ok" };
    if (c.includes("desarrollo") || c.includes("medio")) return { label: "En desarrollo", status: "medio" };
    if (c.includes("frío") || c.includes("bajo")) return { label: "Frío", status: "bajo" };
  }
  const progress = getLeadProgressPercent(l);
  if (progress >= 100) return { label: "Completo", status: "ok" };
  if (progress >= 25) return { label: "En curso", status: "medio" };
  if (progress > 0) return { label: "En curso", status: "medio" };
  return { label: "Nuevo", status: "nuevo" };
}

/** Estado visual: verde Completo, amarillo Activo, rojo Bloqueado (sin datos mínimos), gris Nuevo. */
function getLeadEstadoVisual(l: LeadOption): "finalizado" | "en_curso" | "nuevo" | "bloqueado" {
  const progress = getLeadProgressPercent(l);
  if (progress >= 100) return "finalizado";
  if (progress > 0) return "en_curso";
  const hasNombreOrEmpresa = hasStr(l.empresas?.nombre) || hasStr(l.nombre);
  const hasAnyContact = hasStr(l.contacto) || hasStr(l.telefono) || hasStr(l.email);
  if (!hasNombreOrEmpresa || !hasAnyContact) return "bloqueado";
  return "nuevo";
}

type SaludCounts = { completo: number; activo: number; bloqueado: number; nuevo: number; total: number };

function computeSaludCounts(items: LeadOption[]): SaludCounts {
  let completo = 0;
  let activo = 0;
  let bloqueado = 0;
  let nuevo = 0;
  for (const l of items) {
    const e = getLeadEstadoVisual(l);
    if (e === "finalizado") completo++;
    else if (e === "en_curso") activo++;
    else if (e === "bloqueado") bloqueado++;
    else nuevo++;
  }
  return { completo, activo, bloqueado, nuevo, total: items.length };
}

type SaludAccionTipo = "bloqueado" | "activo" | "nuevo" | "completo";

function matchesSaludAccion(l: LeadOption, tipo: SaludAccionTipo): boolean {
  const e = getLeadEstadoVisual(l);
  if (tipo === "completo") return e === "finalizado";
  if (tipo === "activo") return e === "en_curso";
  if (tipo === "bloqueado") return e === "bloqueado";
  return e === "nuevo";
}

/** Una línea de insight con proporciones (no altera conteos). */
function saludInsightLine(c: SaludCounts): string | null {
  const { completo, activo, nuevo, total } = c;
  if (total === 0) return null;
  if (nuevo > activo && nuevo > 0) {
    return "Hay más leads nuevos que activos.";
  }
  const pA = Math.round((activo / total) * 100);
  const pC = Math.round((completo / total) * 100);
  if (pA >= 45) return `El ${pA}% está en curso.`;
  if (pC <= 15 && total >= 4) return `Solo el ${pC}% está completo.`;
  if (pC >= 40) return `El ${pC}% ya está completo.`;
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
  const { completo, activo, bloqueado, nuevo, total } = counts;
  const w = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const insight = saludInsightLine(counts);
  const wrap =
    variant === "global"
      ? "mt-2 rounded-lg border border-slate-200/70 bg-slate-50/50 px-3 py-2.5"
      : "mt-2 rounded-lg border border-slate-200/70 bg-slate-100/40 px-3 py-2.5";

  const m = Math.max(completo, activo, nuevo);
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
    } else if (m === activo && activo > completo) {
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
    } else if (m === nuevo && nuevo > activo && nuevo > completo) {
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
    } else if (m === completo && completo > activo && completo > 0) {
      primaryLine = (
        <>
          <span className="text-base" aria-hidden>
            🟢
          </span>{" "}
          <span className="font-medium text-slate-800">
            {completo === 1 ? "1 lead completo" : `${completo} leads completos`}
          </span>
          {" — "}
          <button type="button" className={linkBtn} onClick={() => onVerGrupo("completo")}>
            revisar cierres
          </button>
        </>
      );
    } else {
      const fallback: SaludAccionTipo =
        activo >= nuevo && activo >= completo && activo > 0 ? "activo" : nuevo > 0 ? "nuevo" : completo > 0 ? "completo" : "activo";
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
              title="Ver completos"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
              Completo: <span className="tabular-nums">{completo}</span>
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
            aria-label={`Salud: ${completo} completo, ${activo} activo, ${bloqueado} bloqueado, ${nuevo} nuevo`}
          >
            {completo > 0 && (
              <div className="h-full min-w-px shrink-0 bg-emerald-400/90" style={{ width: `${w(completo)}%` }} title={`Completo: ${completo}`} />
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

type ViewMode = "kanban" | "listado";
const PIPELINE_FILTER_OPTIONS = ["Todos", ...KANBAN_COLUMNS];

const SALUD_URL_KEYS = ["bloqueado", "activo", "nuevo", "completo"] as const;

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

function parseComercialFilterFromUrl(sp: URLSearchParams): ComercialFilterValue {
  const raw = (sp.get("comercial") ?? "").trim();
  const lower = raw.toLowerCase();
  if (lower === "mine") return "mine";
  if (lower === "all") return "all";
  if (raw.length > 0) return raw;
  const mineLegacy = (sp.get("mine") ?? "").trim().toLowerCase();
  if (mineLegacy === "1" || mineLegacy === "true") return "mine";
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
    fetch("/api/admin/leads", { cache: "no-store", headers: { "Cache-Control": "no-store" } })
      .then(async (res) => {
        const json = (await res.json()) as { data?: LeadOption[]; error?: string };
        if (!res.ok) throw new Error(json?.error ?? "Error cargando leads");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        const data = Array.isArray(json?.data) ? json.data : [];
        const active = data.filter((l) => l?.id && !CLOSED_PIPELINES.has(normPipeline(l.pipeline)));
        setLeads(active);
      })
      .catch(() => {
        if (!cancelled) setLeads([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLeads(false);
      });
    return () => {
      cancelled = true;
    };
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

  const displayLeads = useMemo(() => {
    if (!saludDrill) return filteredLeads;
    const base = saludDrill.scope === "global" ? leads : filteredLeads;
    return base.filter((l) => matchesSaludAccion(l, saludDrill.tipo));
  }, [leads, filteredLeads, saludDrill]);

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
    completo: "completados",
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

  /** Métricas sobre el universo completo de leads cargados (sin filtros de vista). */
  const globalMetrics = useMemo(() => {
    let enPropuesta = 0;
    let enSeguimiento = 0;
    let nuevas = 0;
    for (const l of leads) {
      const n = normPipeline(l.pipeline);
      if (n === "nuevo") nuevas++;
      else if (n === "propuesta") enPropuesta++;
      else if (n === "seguimiento") enSeguimiento++;
    }
    return {
      activas: leads.length,
      enPropuesta,
      enSeguimiento,
      nuevas,
    };
  }, [leads]);

  /** Métricas sobre filteredLeads (pipeline, búsqueda y comercial). */
  const summaryMetrics = useMemo(() => {
    let enPropuesta = 0;
    let enSeguimiento = 0;
    let nuevas = 0;
    for (const l of filteredLeads) {
      const n = normPipeline(l.pipeline);
      if (n === "nuevo") nuevas++;
      else if (n === "propuesta") enPropuesta++;
      else if (n === "seguimiento") enSeguimiento++;
    }
    return {
      activas: filteredLeads.length,
      enPropuesta,
      enSeguimiento,
      nuevas,
    };
  }, [filteredLeads]);

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
      </div>

      {/* Abrir oportunidad LEADS87 */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

      {/* Métricas: global (izq.) + resultado actual (der.) en xl+ */}
      <div className="mt-4 grid grid-cols-1 gap-6 xl:mt-5 xl:grid-cols-2 xl:items-stretch">
        {/* Métricas globales */}
        <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm xl:h-full">
          <p className="mb-1.5 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-600">Métricas globales</p>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Activas</p>
              <p className="mt-0.5 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : globalMetrics.activas}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En propuesta</p>
              <p className="mt-0.5 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : globalMetrics.enPropuesta}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En seguimiento</p>
              <p className="mt-0.5 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : globalMetrics.enSeguimiento}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nuevas</p>
              <p className="mt-0.5 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : globalMetrics.nuevas}</p>
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
        {/* Vista filtrada / Resultado actual */}
        <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm xl:h-full">
          <p className="mb-1.5 flex shrink-0 flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vista filtrada
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium normal-case text-slate-600">Resultado actual</span>
          </p>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Activas</p>
              <p className="mt-0.5 text-xl font-semibold text-slate-700">{loadingLeads ? "—" : summaryMetrics.activas}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En propuesta</p>
              <p className="mt-0.5 text-xl font-semibold text-slate-700">{loadingLeads ? "—" : summaryMetrics.enPropuesta}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En seguimiento</p>
              <p className="mt-0.5 text-xl font-semibold text-slate-700">{loadingLeads ? "—" : summaryMetrics.enSeguimiento}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nuevas</p>
              <p className="mt-0.5 text-xl font-semibold text-slate-700">{loadingLeads ? "—" : summaryMetrics.nuevas}</p>
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
            placeholder="Buscar empresa, contacto o email"
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

      {/* Contenido */}
      <div id="leads87-tabla" className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden scroll-mt-4">
        {viewMode === "listado" && (
          <>
            {loadingLeads ? (
              <div className="p-8 text-sm text-slate-600">Cargando oportunidades…</div>
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
                      <th scope="col" className="px-4 py-3">Empresa / Lead</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Salud</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">% avance</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Etapa actual</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap">Estado</th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {displayLeads.map((l) => {
                      const progress = getLeadProgressPercent(l);
                      const etapa = getEtapaActualLabel(l);
                      const salud = getLeadSalud(l);
                      const estado = getLeadEstadoVisual(l);
                      const rowBg =
                        estado === "finalizado"
                          ? "bg-emerald-50/50"
                          : estado === "en_curso"
                            ? "bg-amber-50/30"
                            : estado === "bloqueado"
                              ? "bg-red-50/30"
                              : "bg-slate-50/20";
                      const estadoLabel =
                        estado === "finalizado"
                          ? "Completo"
                          : estado === "en_curso"
                            ? "Activo"
                            : estado === "bloqueado"
                              ? "Bloqueado"
                              : "Nuevo";
                      const estadoBadgeClass =
                        estado === "finalizado"
                          ? "bg-emerald-100 text-emerald-800"
                          : estado === "en_curso"
                            ? "bg-amber-100 text-amber-800"
                            : estado === "bloqueado"
                              ? "bg-red-100 text-red-800"
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
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {etapa}
                          </td>
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
                            const progress = getLeadProgressPercent(l);
                            const etapa = getEtapaActualLabel(l);
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
                          const progress = getLeadProgressPercent(l);
                          const etapa = getEtapaActualLabel(l);
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
