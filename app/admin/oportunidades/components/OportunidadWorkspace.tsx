"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RubroSelect from "../../empresas/RubroSelect";

/** Forma mínima del lead (misma que /admin/oportunidades/[id]). */
export type OportunidadLeadProp = {
  id?: string | null;
  nombre?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  website?: string | null;
  linkedin_empresa?: string | null;
  linkedin_personal?: string | null;
  linkedin_director?: string | null;
  pipeline?: string | null;
  origen?: string | null;
  objetivos?: string | null;
  empresa_id?: string | null;
  empresas?: {
    id?: string | null;
    nombre?: string | null;
    rubro_id?: string | null;
    rubros?: { id?: string | null; nombre?: string | null } | null;
  } | null;
} | null;

type ContextoEditForm = {
  nombre: string;
  contacto: string;
  email: string;
  telefono: string;
  website: string;
  linkedin_empresa: string;
  linkedin_personal: string;
  rubro_id: string | null;
  origen: string;
  objetivos: string;
  redes: string;
};

/** Normaliza pipeline para mapear a etapa (minúsculas, sin acentos). */
function normPipeline(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasValue(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** true si empresa/nombre, contacto y (email o teléfono) están completos (para avance Lead → Investigación). */
function isRequiredLeadDataComplete(lead: OportunidadLeadProp): boolean {
  if (!lead) return false;
  const empresa = lead.empresas?.nombre ?? lead.nombre;
  const contacto = lead.contacto;
  const emailOrPhone = hasValue(lead.email) || hasValue(lead.telefono);
  return hasValue(empresa) && hasValue(contacto) && emailOrPhone;
}

/** Mapeo pipeline → índice de etapa (0–7). */
const PIPELINE_TO_STAGE: Record<string, number> = {
  nuevo: 0,
  contactado: 1,
  investigacion: 1,
  analisis: 2,
  diagnostico: 2,
  estrategia: 3,
  servicios: 4,
  propuesta: 5,
  presentacion: 6,
  seguimiento: 7,
  cierre: 7,
};

const MAP_STEP_LABELS = ["Etapa 1", "Etapa 2", "Etapa 3", "Etapa 4", "Etapa 5", "Etapa 6", "Etapa 7", "Etapa 8"];
const PASO_ACTUAL_LABELS = [
  "Etapa 1 — Lead creado / datos base",
  "Etapa 2 — Investigación",
  "Etapa 3 — Diagnóstico comercial",
  "Etapa 4 — Estrategia",
  "Etapa 5 — Estructura de servicios",
  "Etapa 6 — Propuesta comercial",
  "Etapa 7 — Presentación",
  "Etapa 8 — Seguimiento y cierre",
];

/** Nombres de pipeline para cada etapa (0..7). Usado al avanzar: siguiente etapa = NEXT_PIPELINE_NAMES[currentIndex + 1]. */
const NEXT_PIPELINE_NAMES = ["Nuevo", "Contactado", "Diagnóstico", "Estrategia", "Servicios", "Propuesta", "Presentación", "Seguimiento"];

const WORKSPACE_TABS = [
  { id: "contexto", label: "Contexto" },
  { id: "investigacion", label: "Investigación" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "acciones", label: "Estrategia" },
  { id: "servicios", label: "Servicios" },
  { id: "propuesta", label: "Propuesta" },
] as const;

/** Estados de documento según etapa del proceso (0=Lead … 7=Cierre). */
type DocEstado = "No iniciado" | "En curso" | "Borrador" | "Pendiente" | "Bloqueado" | "Listo";

function getDocumentosEstados(stageIndex: number | null): [DocEstado, DocEstado, DocEstado, DocEstado] {
  const s = stageIndex ?? 0;
  if (s <= 0) return ["No iniciado", "Bloqueado", "Bloqueado", "Bloqueado"];
  if (s === 1) return ["Borrador", "Pendiente", "Bloqueado", "Bloqueado"];
  if (s === 2) return ["Listo", "Borrador", "Pendiente", "Bloqueado"];
  if (s === 3) return ["Listo", "Listo", "Borrador", "Pendiente"];
  if (s === 4) return ["Listo", "Listo", "Listo", "Pendiente"];
  if (s === 5) return ["Listo", "Listo", "Listo", "Borrador"];
  return ["Listo", "Listo", "Listo", "Listo"];
}

function badgeClasses(estado: DocEstado): string {
  switch (estado) {
    case "No iniciado":
      return "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600";
    case "En curso":
      return "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800";
    case "Borrador":
      return "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800";
    case "Pendiente":
      return "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600";
    case "Bloqueado":
      return "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500";
    case "Listo":
      return "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800";
    default:
      return "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600";
  }
}

/** Cabecera reutilizable de etapa para las tabs del Workspace (Investigación, Diagnóstico, etc.). */
function TabStageHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-slate-200 pb-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Etapa actual</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-800">{title}</h2>
    </div>
  );
}

function format(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

type Props = {
  lead: OportunidadLeadProp;
  id: string | null;
  /** Índice de etapa activa (fuente única desde la página: barra + workspace). Lead completo con pipeline nuevo = 1. */
  activeStageIndex?: number;
  /** Llamado tras actualizar la etapa del lead para que el padre refresque los datos. */
  onLeadUpdated?: () => void;
  /** Ref que el padre puede usar para activar la tab Contexto y llevar al usuario al workspace. */
  focusContextoRef?: React.MutableRefObject<(() => void) | null>;
  /** Ref que el padre puede usar para activar la tab Investigación (p. ej. botón "Iniciar investigación"). */
  focusInvestigacionRef?: React.MutableRefObject<(() => void) | null>;
  /** Ref para abrir la tab del workspace según etapa activa (0=Lead→Contexto, 1=Investigación, 2=Diagnóstico, 3=Estrategia, 4=Servicios, 5+=Propuesta). */
  focusWorkspaceStageRef?: React.MutableRefObject<((stageIndex: number) => void) | null>;
  /** Llamado cuando el usuario pide editar el lead desde la tab Contexto (abre ficha en header). */
  onRequestEditLead?: () => void;
};

/** Mapeo índice de etapa (0–7) a id de tab del workspace. Presentación/Cierre → propuesta como fallback. */
function stageIndexToTabId(stageIndex: number): (typeof WORKSPACE_TABS)[number]["id"] {
  switch (stageIndex) {
    case 0: return "contexto";
    case 1: return "investigacion";
    case 2: return "diagnostico";
    case 3: return "acciones";
    case 4: return "servicios";
    case 5:
    case 6:
    case 7:
    default: return "propuesta";
  }
}

function getContextoCompletitud(lead: OportunidadLeadProp): number {
  if (!lead) return 0;
  const empresa = lead.empresas?.nombre ?? lead.nombre;
  const rubro = lead.empresas?.rubros?.nombre;
  const linkedin = lead.linkedin_empresa ?? lead.linkedin_personal ?? lead.linkedin_director;
  const fields = [
    hasValue(empresa),
    hasValue(lead.contacto),
    hasValue(lead.email),
    hasValue(lead.telefono),
    hasValue(rubro),
    hasValue(lead.origen),
    hasValue(lead.website),
    hasValue(linkedin),
    false, // redes: no hay campo en lead por ahora
    hasValue(lead.objetivos),
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

export type LeadScoreBreakdown = {
  calidadLead: number;   // 0–25
  presenciaDigital: number; // 0–25
  madurez: number;      // 0–25
  oportunidad: number;  // 0–25
};

export type LeadScoreResult = {
  total: number;        // 0–100
  breakdown: LeadScoreBreakdown;
  status: "frío" | "en desarrollo" | "listo";
};

/**
 * Score comercial básico a partir de datos del lead (sin backend ni IA).
 * - Calidad: empresa, contacto, email o teléfono, rubro, origen.
 * - Presencia digital: web, linkedin, redes (redes no existe en lead, se deja en 0).
 * - Madurez: objetivo, origen.
 * - Oportunidad: falta de web, falta de linkedin (más hueco = más oportunidad de valor).
 */
function calculateLeadScore(lead: OportunidadLeadProp): LeadScoreResult {
  const empty: LeadScoreBreakdown = { calidadLead: 0, presenciaDigital: 0, madurez: 0, oportunidad: 0 };
  if (!lead) return { total: 0, breakdown: empty, status: "frío" };

  const empresa = hasValue(lead.empresas?.nombre ?? lead.nombre);
  const contacto = hasValue(lead.contacto);
  const emailOrTel = hasValue(lead.email) || hasValue(lead.telefono);
  const rubro = hasValue(lead.empresas?.rubros?.nombre);
  const origen = hasValue(lead.origen);
  const calidadCount = [empresa, contacto, emailOrTel, rubro, origen].filter(Boolean).length;
  const calidadLead = Math.round((calidadCount / 5) * 25);

  const web = hasValue(lead.website);
  const linkedin = hasValue(lead.linkedin_empresa ?? lead.linkedin_personal ?? lead.linkedin_director);
  const redes = false; // no hay campo en lead
  const presenciaCount = [web, linkedin, redes].filter(Boolean).length;
  const presenciaDigital = Math.round((presenciaCount / 3) * 25);

  const objetivo = hasValue(lead.objetivos);
  const madurezCount = [objetivo, origen].filter(Boolean).length;
  const madurez = Math.round((madurezCount / 2) * 25);

  const faltaWeb = !web ? 1 : 0;
  const faltaLinkedin = !linkedin ? 1 : 0;
  const oportunidadCount = faltaWeb + faltaLinkedin;
  const oportunidad = Math.round((oportunidadCount / 2) * 25);

  const total = Math.min(100, calidadLead + presenciaDigital + madurez + oportunidad);

  let status: "frío" | "en desarrollo" | "listo" = "frío";
  if (total >= 70) status = "listo";
  else if (total >= 40) status = "en desarrollo";

  return {
    total,
    breakdown: { calidadLead, presenciaDigital, madurez, oportunidad },
    status,
  };
}

function getScoreRecommendations(score: LeadScoreResult): string[] {
  const recs: string[] = [];
  if (score.total < 40) {
    recs.push("Completá empresa, contacto y email o teléfono como mínimo.");
    recs.push("Agregá rubro y origen para mejorar la calidad del lead.");
    recs.push("Sumá web y LinkedIn cuando estén disponibles.");
  } else if (score.total < 70) {
    if (score.breakdown.presenciaDigital < 25) recs.push("Completá web y/o LinkedIn para reforzar presencia digital.");
    if (score.breakdown.madurez < 25) recs.push("Definí objetivo del lead para priorizar mejor.");
    recs.push("Revisá que todos los datos de contacto estén correctos antes de avanzar.");
  } else {
    recs.push("Lead con buena base de datos. Podés avanzar a investigación.");
    recs.push("Opcional: completar redes y objetivo para enriquecer el análisis.");
  }
  return recs;
}

const emptyContextoForm: ContextoEditForm = {
  nombre: "",
  contacto: "",
  email: "",
  telefono: "",
  website: "",
  linkedin_empresa: "",
  linkedin_personal: "",
  rubro_id: null,
  origen: "",
  objetivos: "",
  redes: "",
};

/** Índice mínimo de etapa por tab (para bloqueo: tab bloqueada si activeStageIndex < este valor). */
function tabIdToMinStage(tabId: (typeof WORKSPACE_TABS)[number]["id"]): number {
  switch (tabId) {
    case "contexto": return 0;
    case "investigacion": return 1;
    case "diagnostico": return 2;
    case "acciones": return 3;
    case "servicios": return 4;
    case "propuesta": return 5;
    default: return 0;
  }
}

export function OportunidadWorkspace({ lead, id, activeStageIndex = 0, onLeadUpdated, focusContextoRef, focusInvestigacionRef, focusWorkspaceStageRef, onRequestEditLead }: Props) {
  const [workspaceTab, setWorkspaceTab] = useState<(typeof WORKSPACE_TABS)[number]["id"]>("contexto");
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [editingContextoLead, setEditingContextoLead] = useState(false);
  const [savingContextoLead, setSavingContextoLead] = useState(false);
  const [editFormContexto, setEditFormContexto] = useState<ContextoEditForm>(emptyContextoForm);
  const [contextoError, setContextoError] = useState<string | null>(null);

  const leadScore = useMemo(() => calculateLeadScore(lead), [lead]);
  const scoreRecommendations = useMemo(() => getScoreRecommendations(leadScore), [leadScore]);

  const startEditingContexto = useCallback(() => {
    if (!lead) return;
    setEditFormContexto({
      nombre: (lead.empresas?.nombre ?? lead.nombre ?? "").trim(),
      contacto: (lead.contacto ?? "").trim(),
      email: (lead.email ?? "").trim(),
      telefono: (lead.telefono ?? "").trim(),
      website: (lead.website ?? "").trim(),
      linkedin_empresa: (lead.linkedin_empresa ?? "").trim(),
      linkedin_personal: (lead.linkedin_personal ?? lead.linkedin_director ?? "").trim(),
      rubro_id: lead.empresas?.rubro_id ?? lead.empresas?.rubros?.id ?? null,
      origen: (lead.origen ?? "").trim(),
      objetivos: (lead.objetivos ?? "").trim(),
      redes: "", // sin campo en lead; solo visible en formulario
    });
    setEditingContextoLead(true);
    setContextoError(null);
  }, [lead]);

  const saveContextoLead = useCallback(async () => {
    if (!id || !lead?.id) return;
    setSavingContextoLead(true);
    setContextoError(null);
    try {
      const body: Record<string, string | null | boolean> = {
        nombre: editFormContexto.nombre || null,
        contacto: editFormContexto.contacto || null,
        email: editFormContexto.email || null,
        telefono: editFormContexto.telefono || null,
        website: editFormContexto.website || null,
        linkedin_empresa: editFormContexto.linkedin_empresa || null,
        linkedin_personal: editFormContexto.linkedin_personal || null,
        origen: editFormContexto.origen || null,
        objetivos: editFormContexto.objetivos || null,
      };
      if (!editFormContexto.linkedin_empresa && !editFormContexto.linkedin_personal) body.allow_clear_linkedin = true;
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { data?: unknown; error?: string };
      if (!res.ok) {
        setContextoError(json?.error ?? "Error al guardar");
        return;
      }
      const empresaId = lead.empresa_id ?? lead.empresas?.id;
      if (empresaId) {
        const rubroIdToSave = (editFormContexto.rubro_id && String(editFormContexto.rubro_id).trim()) || null;
        const empRes = await fetch(`/api/admin/empresas/${encodeURIComponent(empresaId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ rubro_id: rubroIdToSave }),
        });
        if (!empRes.ok) {
          const empJson = (await empRes.json()) as { error?: string };
          setContextoError(empJson?.error ?? "Error al guardar rubro");
          return;
        }
      }
      setEditingContextoLead(false);
      onLeadUpdated?.();
    } catch (e) {
      setContextoError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingContextoLead(false);
    }
  }, [id, lead?.id, lead?.empresa_id, lead?.empresas?.id, editFormContexto, onLeadUpdated]);

  useEffect(() => {
    if (!focusContextoRef) return;
    focusContextoRef.current = () => setWorkspaceTab("contexto");
    return () => {
      focusContextoRef.current = null;
    };
  }, [focusContextoRef]);

  useEffect(() => {
    if (!focusInvestigacionRef) return;
    focusInvestigacionRef.current = () => setWorkspaceTab("investigacion");
    return () => {
      focusInvestigacionRef.current = null;
    };
  }, [focusInvestigacionRef]);

  useEffect(() => {
    if (!focusWorkspaceStageRef) return;
    focusWorkspaceStageRef.current = (stageIndex: number) => {
      const tabId = stageIndexToTabId(stageIndex);
      setWorkspaceTab(tabId);
    };
    return () => {
      focusWorkspaceStageRef.current = null;
    };
  }, [focusWorkspaceStageRef]);

  /** Sincronizar tab con la etapa activa (fuente única desde la página). */
  useEffect(() => {
    setWorkspaceTab(stageIndexToTabId(activeStageIndex));
  }, [activeStageIndex]);

  const currentStageIndex = useMemo((): number | null => {
    if (!lead?.pipeline) return null;
    const key = normPipeline(lead.pipeline);
    const idx = PIPELINE_TO_STAGE[key];
    return typeof idx === "number" ? idx : null;
  }, [lead?.pipeline]);

  const isPipelineNuevo = lead != null && normPipeline(lead.pipeline) === "nuevo";

  /** Placeholders para reglas de avance (sin persistencia todavía). */
  const diagnosticoCompleto = false;
  const estrategiaCompleta = false;
  const serviciosDefinidos = false;
  const propuestaGenerada = false;
  const presentacionRealizada = false;

  /** Tabs bloqueadas: no se puede entrar si la etapa activa es anterior o no se cumplió el prerequisito. Contexto siempre habilitada. */
  const isTabLocked = useCallback(
    (tabId: (typeof WORKSPACE_TABS)[number]["id"]): boolean => {
      const minStage = tabIdToMinStage(tabId);
      if (activeStageIndex < minStage) return true;
      switch (tabId) {
        case "contexto":
          return false;
        case "investigacion":
          return false;
        case "diagnostico":
          return analysisVersion === 0;
        case "acciones":
          return !diagnosticoCompleto;
        case "servicios":
          return !estrategiaCompleta;
        case "propuesta":
          return !serviciosDefinidos;
        default:
          return false;
      }
    },
    [activeStageIndex, analysisVersion, diagnosticoCompleto, estrategiaCompleta, serviciosDefinidos]
  );

  const currentTabLocked = isTabLocked(workspaceTab);

  /** Calcula si la etapa actual está lista para avanzar y cuál sería la siguiente. */
  const advanceStatus = useMemo(() => {
    const stage = currentStageIndex ?? 0;
    const nextLabel = stage < 7 ? MAP_STEP_LABELS[stage + 1] : null;
    let ready = false;
    if (stage >= 7) {
      ready = false;
    } else if (stage === 0) {
      ready = isRequiredLeadDataComplete(lead);
    } else if (stage === 1) {
      ready = analysisVersion > 0;
    } else if (stage === 2) {
      ready = diagnosticoCompleto;
    } else if (stage === 3) {
      ready = estrategiaCompleta;
    } else if (stage === 4) {
      ready = serviciosDefinidos;
    } else if (stage === 5) {
      ready = propuestaGenerada;
    } else if (stage === 6) {
      ready = presentacionRealizada;
    }
    return { ready, nextLabel };
  }, [currentStageIndex, lead, analysisVersion, diagnosticoCompleto, estrategiaCompleta, serviciosDefinidos, propuestaGenerada, presentacionRealizada]);

  const documentosEstados = useMemo(
    () => getDocumentosEstados(currentStageIndex),
    [currentStageIndex]
  );

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Mapa técnico del proceso — colapsado por defecto */}
      <details className="group rounded-xl border border-slate-200 bg-white shadow-sm [&_summary]:cursor-pointer [&_summary]:select-none [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-5 py-4 hover:bg-slate-50/50">
          <span className="text-sm font-semibold text-slate-800">Mapa técnico del proceso</span>
          <span className="text-xs text-slate-500">ver detalle</span>
        </summary>
        <div className="border-t border-slate-200 p-5 pt-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Etapa actual:</span> {currentStageIndex !== null ? MAP_STEP_LABELS[currentStageIndex] : "Investigación"}</p>
            <p className="mt-1 text-sm text-slate-600"><span className="font-medium text-slate-700">Paso actual:</span> {currentStageIndex !== null ? PASO_ACTUAL_LABELS[currentStageIndex] : "Análisis del lead"}</p>
            <p className="mt-1 text-sm text-slate-600"><span className="font-medium text-slate-700">Siguiente paso:</span> {currentStageIndex !== null ? (currentStageIndex < 7 ? PASO_ACTUAL_LABELS[currentStageIndex + 1] : "Cierre") : "Diagnóstico comercial"}</p>
          </div>

          {lead && (
            <div className="mt-4">
              {currentStageIndex !== null && currentStageIndex >= 7 ? (
                <p className="text-sm font-medium text-emerald-700">Proceso comercial finalizado.</p>
              ) : advanceStatus.ready && advanceStatus.nextLabel ? (
                <p className="text-sm font-medium text-emerald-700">Listo para avanzar a {advanceStatus.nextLabel}</p>
              ) : (
                <p className="text-xs text-slate-500">Esta etapa aún no está lista para avanzar</p>
              )}
            </div>
          )}

          <div className="mt-5 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investigación</p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                <li>activos digitales</li>
                <li>redes sociales</li>
                <li>posicionamiento</li>
                <li>competencia</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnóstico</p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                <li>FODA</li>
                <li>fricciones comerciales</li>
                <li>oportunidades</li>
              </ul>
            </div>
          </div>
        </div>
      </details>

      {/* Workspace operativo (id para scroll desde "Revisar datos de la oportunidad") */}
      <div id="oportunidad-contexto" className="rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">Workspace operativo</h2>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {WORKSPACE_TABS.map((tab) => {
            const locked = isTabLocked(tab.id);
            const lockIcon = (
              <svg className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm2-2v2h6V7a3 3 0 00-6 0v2h2z" clipRule="evenodd" />
              </svg>
            );
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setWorkspaceTab(tab.id)}
                title={locked ? "Primero debes completar la etapa anterior para acceder aquí" : undefined}
                className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                  locked ? "cursor-not-allowed opacity-60" : ""
                } ${
                  workspaceTab === tab.id
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                } ${locked && workspaceTab !== tab.id ? "hover:opacity-70" : ""}`}
              >
                {locked ? lockIcon : null}
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          {currentTabLocked ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-6 text-center">
              <p className="text-sm font-medium text-amber-900">Primero debes completar la etapa anterior para acceder aquí.</p>
            </div>
          ) : (
            <>
              {isPipelineNuevo && (
                <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Qué hacer ahora</h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Validá y completá los datos mínimos para poder avanzar a investigación.
                  </p>
                  <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                    <li>Confirmar empresa y contacto</li>
                    <li>Validar email o teléfono</li>
                    <li>Revisar origen, web y LinkedIn si existe</li>
                  </ul>
                </div>
              )}
              {workspaceTab === "contexto" && (
            <div id="oportunidad-tab-contexto" className="space-y-4">
              <TabStageHeader title="Contexto" />
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Qué hacer ahora</h3>
                <p className="mt-1.5 text-sm text-slate-600">Completá los datos de la empresa y del contacto para cerrar la etapa Lead y avanzar a investigación.</p>
                <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                  <li>Confirmar empresa, contacto y rubro</li>
                  <li>Validar email o teléfono y origen</li>
                  <li>Completar web, LinkedIn y objetivo si aplica</li>
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Datos del lead</p>
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${getContextoCompletitud(lead)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-600">{getContextoCompletitud(lead)}%</span>
                  </div>
                  {!editingContextoLead ? (
                    <button
                      type="button"
                      onClick={startEditingContexto}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Editar
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditingContextoLead(false); setContextoError(null); }}
                        disabled={savingContextoLead}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveContextoLead}
                        disabled={savingContextoLead}
                        className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {savingContextoLead ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  )}
                </div>
                {contextoError && (
                  <p className="mt-2 text-sm text-red-600">{contextoError}</p>
                )}
                {editingContextoLead ? (
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <label className="block text-xs text-slate-500">Empresa<span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={editFormContexto.nombre}
                        onChange={(e) => setEditFormContexto((f) => ({ ...f, nombre: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Contacto<span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={editFormContexto.contacto}
                        onChange={(e) => setEditFormContexto((f) => ({ ...f, contacto: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500">Email o teléfono (al menos uno)</p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Email</label>
                      <input
                        type="text"
                        value={editFormContexto.email}
                        onChange={(e) => setEditFormContexto((f) => ({ ...f, email: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Teléfono</label>
                      <input
                        type="text"
                        value={editFormContexto.telefono}
                        onChange={(e) => setEditFormContexto((f) => ({ ...f, telefono: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Rubro</label>
                      <div className="mt-0.5">
                        {lead?.empresa_id ?? lead?.empresas?.id ? (
                          <RubroSelect
                            value={editFormContexto.rubro_id ?? null}
                            onChange={(nextId) => setEditFormContexto((f) => ({ ...f, rubro_id: nextId }))}
                            placeholder="Seleccionar rubro…"
                          />
                        ) : (
                          <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">Sin empresa vinculada.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Origen</label>
                      <input
                        type="text"
                        value={editFormContexto.origen}
                        onChange={(e) => setEditFormContexto((f) => ({ ...f, origen: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Web</label>
                      <input
                        type="text"
                        value={editFormContexto.website}
                        onChange={(e) => setEditFormContexto((f) => ({ ...f, website: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">LinkedIn</label>
                      <input
                        type="text"
                        value={editFormContexto.linkedin_empresa || editFormContexto.linkedin_personal}
                        onChange={(e) => setEditFormContexto((f) => ({ ...f, linkedin_empresa: e.target.value, linkedin_personal: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                        placeholder="URL LinkedIn empresa o perfil"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Redes</label>
                      <input
                        type="text"
                        value={editFormContexto.redes}
                        onChange={(e) => setEditFormContexto((f) => ({ ...f, redes: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                        placeholder="Ej. Instagram, Facebook…"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Objetivo</label>
                      <input
                        type="text"
                        value={editFormContexto.objetivos}
                        onChange={(e) => setEditFormContexto((f) => ({ ...f, objetivos: e.target.value }))}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div><p className="text-xs text-slate-500">Empresa</p><p className="mt-0.5 font-medium text-slate-800">{format(lead?.empresas?.nombre ?? lead?.nombre) || "—"}</p></div>
                    <div><p className="text-xs text-slate-500">Contacto</p><p className="mt-0.5 font-medium text-slate-800">{format(lead?.contacto) || "—"}</p></div>
                    <div><p className="text-xs text-slate-500">Email</p><p className="mt-0.5 font-medium text-slate-800">{format(lead?.email) || "—"}</p></div>
                    <div><p className="text-xs text-slate-500">Teléfono</p><p className="mt-0.5 font-medium text-slate-800">{format(lead?.telefono) || "—"}</p></div>
                    <div><p className="text-xs text-slate-500">Rubro</p><p className="mt-0.5 font-medium text-slate-800">{format(lead?.empresas?.rubros?.nombre) || "—"}</p></div>
                    <div><p className="text-xs text-slate-500">Origen</p><p className="mt-0.5 font-medium text-slate-800">{format(lead?.origen) || "—"}</p></div>
                    <div><p className="text-xs text-slate-500">Web</p><p className="mt-0.5 font-medium text-slate-800">{format(lead?.website) || "—"}</p></div>
                    <div><p className="text-xs text-slate-500">LinkedIn</p><p className="mt-0.5 font-medium text-slate-800">{format(lead?.linkedin_empresa ?? lead?.linkedin_personal ?? lead?.linkedin_director) || "—"}</p></div>
                    <div><p className="text-xs text-slate-500">Redes</p><p className="mt-0.5 font-medium text-slate-800">—</p></div>
                    <div><p className="text-xs text-slate-500">Objetivo</p><p className="mt-0.5 font-medium text-slate-800">{format(lead?.objetivos) || "—"}</p></div>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score comercial</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-800">{leadScore.total}</span>
                  <span className="text-lg text-slate-500">/100</span>
                  <span
                    className={
                      leadScore.status === "listo"
                        ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                        : leadScore.status === "en desarrollo"
                          ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                          : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                    }
                  >
                    {leadScore.status === "listo" ? "Listo" : leadScore.status === "en desarrollo" ? "En desarrollo" : "Frío"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>Calidad del lead: {leadScore.breakdown.calidadLead}/25</span>
                  <span>Presencia digital: {leadScore.breakdown.presenciaDigital}/25</span>
                  <span>Madurez: {leadScore.breakdown.madurez}/25</span>
                  <span>Oportunidad: {leadScore.breakdown.oportunidad}/25</span>
                </div>
                {scoreRecommendations.length > 0 && (
                  <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                    {scoreRecommendations.map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lectura automática del CRM</p>
                {analysisVersion === 0 ? (
                  <>
                    <p className="mt-2 text-sm font-medium text-slate-700">Estado: Pendiente de análisis</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Completa más información del lead o genera el análisis comercial para obtener una lectura automática real.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">
                    Lectura automática disponible próximamente a partir del análisis generado.
                  </p>
                )}
              </div>
            </div>
          )}
          {workspaceTab === "investigacion" && (
            <div id="oportunidad-tab-investigacion" className="space-y-4">
              <TabStageHeader title="Investigación" />
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Qué hacer ahora</h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  {analysisVersion > 0 ? "El análisis ya fue generado. Revisá el informe o regenerá con los datos actuales." : "Genera el análisis comercial inicial para comenzar la etapa de investigación."}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {analysisVersion > 0 ? (
                    <>
                      <Link
                        href={id ? `/admin/leads/${id}?tab=comercial&section=ia-report-block` : "#"}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
                        title="Abre el análisis generado para revisar oportunidades y diagnóstico."
                      >
                        Ver informe comercial
                      </Link>
                      <button
                        type="button"
                        onClick={() => setAnalysisVersion((v) => v + 1)}
                        title="Vuelve a generar el análisis usando los datos actuales del lead."
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
                      >
                        Regenerar análisis
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                        <Link
                          href={id ? `/admin/leads/${id}?tab=comercial&section=ia-report-block` : "#"}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Descargar PDF
                        </Link>
                        <Link
                          href={id ? `/admin/leads/${id}?tab=comercial&section=ia-report-block` : "#"}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Generar Gamma comercial
                        </Link>
                        <Link
                          href={id ? `/admin/leads/${id}?tab=comercial&section=ia-report-block` : "#"}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Copiar contenido
                        </Link>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAnalysisVersion((v) => v + 1)}
                      className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      Generar análisis comercial
                    </button>
                  )}
                </div>
                {analysisVersion > 0 && (
                  <div className="mt-2 space-y-0.5 text-center text-xs text-slate-500">
                    <p>Versión actual: v{analysisVersion}</p>
                  </div>
                )}
              </div>
              {analysisVersion === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Salidas de investigación</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">PDF informe comercial</span>
                      <span className="text-xs text-slate-500">— Disponible tras generar análisis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Generar Gamma comercial</span>
                      <span className="text-xs text-slate-500">— Disponible tras generar análisis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Copiar contenido</span>
                      <span className="text-xs text-slate-500">— Disponible tras generar análisis</span>
                    </li>
                  </ul>
                </div>
              )}
              {analysisVersion > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Historial de análisis</h3>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {Array.from({ length: analysisVersion }, (_, i) => i + 1).map((v) => (
                      <li key={v}>
                        {v === analysisVersion ? (
                          <span className="font-medium text-slate-800">v{v} (actual)</span>
                        ) : (
                          <span>v{v}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h3 className="text-sm font-semibold text-slate-800">Bloques del análisis comercial</h3>
                <p className="mt-1 text-xs text-slate-600">El análisis comercial genera estos bloques de información para apoyar las siguientes etapas del proceso.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-xs font-semibold text-slate-600">Investigación</p>
                    <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                      <li>investigación digital</li>
                      <li>redes sociales</li>
                      <li>posicionamiento en mercado</li>
                      <li>competencia</li>
                      <li>LinkedIn tomadores decisión</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-xs font-semibold text-slate-600">Diagnóstico</p>
                    <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                      <li>FODA</li>
                      <li>oportunidades</li>
                      <li>prestigio IA</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-xs font-semibold text-slate-600">Estrategia</p>
                    <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                      <li>plan de crecimiento</li>
                      <li>visión estratégica</li>
                      <li>oportunidades de negocio EASY</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-xs font-semibold text-slate-600">Conversión</p>
                    <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                      <li>acciones</li>
                      <li>materiales listos</li>
                      <li>cierre de venta</li>
                      <li>propuesta crecimiento EASY</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Personalización IA</p>
                <p className="text-xs text-slate-600 mb-4">El prompt original no se modifica; solo podés trabajar sobre una copia personalizada por lead.</p>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">Investigación digital</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt original (solo lectura)</p>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap">Analizar presencia digital del lead: web, redes, contenido publicado y coherencia de mensaje. No modificar este texto.</div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt personalizado</p>
                        <textarea readOnly placeholder="Copia editable para este lead" className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 min-h-[72px] resize-y" defaultValue="Incluir también revisión de LinkedIn empresa y competencia directa." />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver original</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Duplicar</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar copia</button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">FODA</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt original (solo lectura)</p>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap">Elaborar FODA del negocio del lead a partir de la investigación. Fortalezas, debilidades, oportunidades y amenazas. No modificar este texto.</div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt personalizado</p>
                        <textarea readOnly placeholder="Copia editable para este lead" className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 min-h-[72px] resize-y" defaultValue="Priorizar oportunidades de membresía y eventos." />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver original</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Duplicar</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar copia</button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">Plan de crecimiento</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt original (solo lectura)</p>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap">Proponer plan de crecimiento a 30–90 días alineado al diagnóstico. Acciones concretas y prioridad. No modificar este texto.</div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Prompt personalizado</p>
                        <textarea readOnly placeholder="Copia editable para este lead" className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 min-h-[72px] resize-y" defaultValue="" />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver original</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Duplicar</button>
                      <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar copia</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {workspaceTab === "diagnostico" && (
            <div className="space-y-4">
              <TabStageHeader title="Diagnóstico" />
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Qué hacer ahora</h3>
                <p className="mt-1.5 text-sm text-slate-600">Generá o validá el diagnóstico comercial a partir del informe de investigación.</p>
                <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                  <li>Revisar FODA y fricciones</li>
                  <li>Identificar oportunidades</li>
                </ul>
              </div>
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
                <button type="button" className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Generar diagnóstico comercial</button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Resultados del diagnóstico</h3>
                <p className="mt-0.5 text-xs text-slate-500">FODA, fricciones comerciales y oportunidades.</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li><span className="font-medium text-slate-700">FODA</span> —</li>
                  <li><span className="font-medium text-slate-700">Fricciones comerciales</span> —</li>
                  <li><span className="font-medium text-slate-700">Oportunidades</span> —</li>
                </ul>
              </div>
            </div>
          )}
          {workspaceTab === "acciones" && (
            <div className="space-y-4">
              <TabStageHeader title="Estrategia" />
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Qué hacer ahora</h3>
                <p className="mt-1.5 text-sm text-slate-600">Definí el plan de crecimiento y las prioridades a partir del diagnóstico.</p>
                <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                  <li>Plan de crecimiento a 30–90 días</li>
                  <li>Visión estratégica y prioridades</li>
                </ul>
              </div>
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
                <button type="button" className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Definir plan de crecimiento</button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Resultados de estrategia</h3>
                <p className="mt-0.5 text-xs text-slate-500">Plan de crecimiento, visión estratégica y prioridades.</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li><span className="font-medium text-slate-700">Plan de crecimiento</span> — 30–90 días, acciones concretas</li>
                  <li><span className="font-medium text-slate-700">Visión estratégica</span> — alineada al diagnóstico</li>
                  <li><span className="font-medium text-slate-700">Prioridades</span> — primer bloque de servicios, revisión y cierre</li>
                </ul>
              </div>
            </div>
          )}
          {workspaceTab === "servicios" && (
            <div className="space-y-4">
              <TabStageHeader title="Servicios" />
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Qué hacer ahora</h3>
                <p className="mt-1.5 text-sm text-slate-600">Confirmá la matriz de servicios recomendados y los materiales listos para cierre de venta.</p>
                <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                  <li>Servicios recomendados por problema</li>
                  <li>Materiales listos y cierre de venta</li>
                </ul>
              </div>
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
                <button type="button" className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Confirmar matriz de servicios</button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Resultados: servicios recomendados</h3>
                <p className="mt-0.5 text-xs text-slate-500">Problema, acción y servicio por línea. Materiales listos y cierre de venta.</p>
                <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse border border-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Problema</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Acción</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Servicio</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-600">
                  <tr><td className="border border-slate-200 px-3 py-2">Baja visibilidad en redes</td><td className="border border-slate-200 px-3 py-2">Estrategia y gestión</td><td className="border border-slate-200 px-3 py-2">Community management</td></tr>
                  <tr><td className="border border-slate-200 px-3 py-2">Falta de datos de conversión</td><td className="border border-slate-200 px-3 py-2">Implementar medición</td><td className="border border-slate-200 px-3 py-2">Pixel y CAPI</td></tr>
                  <tr><td className="border border-slate-200 px-3 py-2">Desalineación con competencia</td><td className="border border-slate-200 px-3 py-2">Posicionamiento</td><td className="border border-slate-200 px-3 py-2">Consultoría estratégica</td></tr>
                </tbody>
              </table>
                </div>
              </div>
            </div>
          )}
          {workspaceTab === "propuesta" && (
            <div className="space-y-4">
              <TabStageHeader title="Propuesta" />
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Qué hacer ahora</h3>
                <p className="mt-1.5 text-sm text-slate-600">Generá la propuesta comercial y exportá o compartí el contenido.</p>
                <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-slate-600">
                  <li>Generar propuesta a partir del plan y servicios</li>
                  <li>Exportar PDF, Gamma o copiar contenido</li>
                </ul>
              </div>
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                <button type="button" className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">Generar propuesta comercial</button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">Resultados / salidas</h3>
                <p className="mt-0.5 text-xs text-slate-500">PDF, Gamma y copiar contenido.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Descargar PDF</button>
                  <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Generar Gamma</button>
                  <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Copiar contenido</button>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* Reportes y documentos */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Reportes y documentos</h2>

        <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-slate-200 pb-4 text-sm text-slate-600">
          <span><span className="font-medium text-slate-700">Total documentos:</span> 4</span>
          <span><span className="font-medium text-slate-700">Última actualización:</span> Hoy</span>
        </div>

        <div className="mt-5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">Informe de investigación</span>
              <span className={badgeClasses(documentosEstados[0])}>{documentosEstados[0]}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Exportar PDF</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Compartir</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">Diagnóstico comercial</span>
              <span className={badgeClasses(documentosEstados[1])}>{documentosEstados[1]}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Exportar PDF</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Compartir</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">Plan estratégico</span>
              <span className={badgeClasses(documentosEstados[2])}>{documentosEstados[2]}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Exportar PDF</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Compartir</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">Propuesta comercial</span>
              <span className={badgeClasses(documentosEstados[3])}>{documentosEstados[3]}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Ver</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Exportar PDF</button>
              <button type="button" className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Compartir</button>
            </div>
          </div>
        </div>
      </div>

      {/* Guía estratégica del proceso — al final, colapsada por defecto, bloque de consulta/apoyo */}
      <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm [&_summary]:cursor-pointer [&_summary]:select-none [&_summary]:rounded-lg [&_summary]:px-3 [&_summary]:py-2 [&_summary]:font-medium [&_summary]:text-slate-700 [&_summary]:hover:bg-slate-100/50">
        <summary className="text-sm">Guía estratégica del proceso</summary>
        <div className="mt-5 space-y-3.5">
          <details className={`rounded-lg border bg-slate-50/50 ${currentStageIndex !== null && 0 < currentStageIndex ? "border-emerald-300 bg-emerald-50/30" : ""} ${currentStageIndex !== null && 0 === currentStageIndex ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"}`}>
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              {currentStageIndex !== null && 0 < currentStageIndex && "✓ "}{currentStageIndex !== null && 0 === currentStageIndex && "→ "}Etapa 1 — Lead creado / datos base
            </summary>
            <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
              <div>
                <p className="font-medium text-slate-700">Objetivo</p>
                <p className="mt-0.5">Comprender el negocio del cliente antes de sugerir soluciones.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Checklist</p>
                <ul className="mt-0.5 list-none space-y-0.5">
                  <li>✔ Lead registrado</li>
                  <li>✔ Responsable asignado</li>
                  <li>☐ Web analizada</li>
                  <li>☐ LinkedIn empresa revisado</li>
                  <li>☐ Competencia identificada</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Tip de neuroventas</p>
                <p className="mt-0.5">Antes de hablar de servicios, demuestra que entiendes cómo gana dinero el cliente.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Error común</p>
                <p className="mt-0.5">Proponer redes sociales sin analizar primero el modelo de captación del negocio.</p>
              </div>
            </div>
          </details>

          <details className={`rounded-lg border bg-slate-50/50 ${currentStageIndex !== null && 1 < currentStageIndex ? "border-emerald-300 bg-emerald-50/30" : ""} ${currentStageIndex !== null && 1 === currentStageIndex ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"}`}>
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              {currentStageIndex !== null && 1 < currentStageIndex && "✓ "}{currentStageIndex !== null && 1 === currentStageIndex && "→ "}Etapa 2 — Investigación
            </summary>
            <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
              <div>
                <p className="font-medium text-slate-700">Objetivo</p>
                <p className="mt-0.5">Recolectar datos del mercado, competencia y perfil del cliente.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Checklist</p>
                <ul className="mt-0.5 list-none space-y-0.5">
                  <li>☐ Fuentes verificadas</li>
                  <li>☐ Pauta y canales revisados</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Tip de neuroventas</p>
                <p className="mt-0.5">Usa datos concretos en la conversación para generar credibilidad.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Error común</p>
                <p className="mt-0.5">Basarse solo en lo que dice el cliente sin contrastar con datos.</p>
              </div>
            </div>
          </details>

          <details className={`rounded-lg border bg-slate-50/50 ${currentStageIndex !== null && 2 < currentStageIndex ? "border-emerald-300 bg-emerald-50/30" : ""} ${currentStageIndex !== null && 2 === currentStageIndex ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"}`}>
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              {currentStageIndex !== null && 2 < currentStageIndex && "✓ "}{currentStageIndex !== null && 2 === currentStageIndex && "→ "}Etapa 3 — Diagnóstico comercial
            </summary>
            <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
              <div>
                <p className="font-medium text-slate-700">Objetivo</p>
                <p className="mt-0.5">Identificar fortalezas, debilidades y oportunidades del negocio del lead.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Checklist</p>
                <ul className="mt-0.5 list-none space-y-0.5">
                  <li>☐ FODA o equivalente</li>
                  <li>☐ Oportunidades priorizadas</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Tip de neuroventas</p>
                <p className="mt-0.5">Presenta el diagnóstico como un espejo del negocio, no como crítica.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Error común</p>
                <p className="mt-0.5">Saltar al cierre sin que el cliente reconozca el diagnóstico.</p>
              </div>
            </div>
          </details>

          <details className={`rounded-lg border bg-slate-50/50 ${currentStageIndex !== null && 3 < currentStageIndex ? "border-emerald-300 bg-emerald-50/30" : ""} ${currentStageIndex !== null && 3 === currentStageIndex ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"}`}>
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              {currentStageIndex !== null && 3 < currentStageIndex && "✓ "}{currentStageIndex !== null && 3 === currentStageIndex && "→ "}Etapa 4 — Estrategia
            </summary>
            <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
              <div>
                <p className="font-medium text-slate-700">Objetivo</p>
                <p className="mt-0.5">Definir el rumbo y las prioridades de crecimiento con el cliente.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Checklist</p>
                <ul className="mt-0.5 list-none space-y-0.5">
                  <li>☐ Visión alineada</li>
                  <li>☐ Métricas acordadas</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Tip de neuroventas</p>
                <p className="mt-0.5">Ancla la estrategia en objetivos que el cliente ya verbalizó.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Error común</p>
                <p className="mt-0.5">Imponer una estrategia sin co-crearla con el decisor.</p>
              </div>
            </div>
          </details>

          <details className={`rounded-lg border bg-slate-50/50 ${currentStageIndex !== null && 4 < currentStageIndex ? "border-emerald-300 bg-emerald-50/30" : ""} ${currentStageIndex !== null && 4 === currentStageIndex ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"}`}>
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              {currentStageIndex !== null && 4 < currentStageIndex && "✓ "}{currentStageIndex !== null && 4 === currentStageIndex && "→ "}Etapa 5 — Estructura de servicios
            </summary>
            <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
              <div>
                <p className="font-medium text-slate-700">Objetivo</p>
                <p className="mt-0.5">Traducir la estrategia en una oferta concreta de servicios y alcance.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Checklist</p>
                <ul className="mt-0.5 list-none space-y-0.5">
                  <li>☐ Servicios alineados al diagnóstico</li>
                  <li>☐ Inversión y plazos definidos</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Tip de neuroventas</p>
                <p className="mt-0.5">Enlaza cada servicio con un dolor u oportunidad que el cliente ya reconoció.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Error común</p>
                <p className="mt-0.5">Vender paquetes estándar sin personalizar al diagnóstico.</p>
              </div>
            </div>
          </details>

          <details className={`rounded-lg border bg-slate-50/50 ${currentStageIndex !== null && 5 < currentStageIndex ? "border-emerald-300 bg-emerald-50/30" : ""} ${currentStageIndex !== null && 5 === currentStageIndex ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"}`}>
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              {currentStageIndex !== null && 5 < currentStageIndex && "✓ "}{currentStageIndex !== null && 5 === currentStageIndex && "→ "}Etapa 6 — Propuesta comercial
            </summary>
            <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
              <div>
                <p className="font-medium text-slate-700">Objetivo</p>
                <p className="mt-0.5">Documentar la oferta, condiciones e inversión para aprobación del cliente.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Checklist</p>
                <ul className="mt-0.5 list-none space-y-0.5">
                  <li>☐ Propuesta generada</li>
                  <li>☐ Revisada con responsable</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Tip de neuroventas</p>
                <p className="mt-0.5">Presenta la propuesta como el siguiente paso natural del diagnóstico.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Error común</p>
                <p className="mt-0.5">Enviar la propuesta por correo sin haber alineado expectativas antes.</p>
              </div>
            </div>
          </details>

          <details className={`rounded-lg border bg-slate-50/50 ${currentStageIndex !== null && 6 < currentStageIndex ? "border-emerald-300 bg-emerald-50/30" : ""} ${currentStageIndex !== null && 6 === currentStageIndex ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"}`}>
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              {currentStageIndex !== null && 6 < currentStageIndex && "✓ "}{currentStageIndex !== null && 6 === currentStageIndex && "→ "}Etapa 7 — Presentación
            </summary>
            <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
              <div>
                <p className="font-medium text-slate-700">Objetivo</p>
                <p className="mt-0.5">Exponer la propuesta y el valor de forma clara y persuasiva.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Checklist</p>
                <ul className="mt-0.5 list-none space-y-0.5">
                  <li>☐ Material preparado</li>
                  <li>☐ Objeciones anticipadas</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Tip de neuroventas</p>
                <p className="mt-0.5">Deja espacio para preguntas y no satures con slides.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Error común</p>
                <p className="mt-0.5">Leer la presentación en lugar de conversar con el cliente.</p>
              </div>
            </div>
          </details>

          <details className={`rounded-lg border bg-slate-50/50 ${currentStageIndex !== null && 7 < currentStageIndex ? "border-emerald-300 bg-emerald-50/30" : ""} ${currentStageIndex !== null && 7 === currentStageIndex ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200"}`}>
            <summary className="cursor-pointer select-none rounded-lg px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-100/50">
              {currentStageIndex !== null && 7 < currentStageIndex && "✓ "}{currentStageIndex !== null && 7 === currentStageIndex && "→ "}Etapa 8 — Seguimiento y cierre
            </summary>
            <div className="border-t border-slate-200 px-3 pb-3 pt-2 text-sm text-slate-600 space-y-3">
              <div>
                <p className="font-medium text-slate-700">Objetivo</p>
                <p className="mt-0.5">Cerrar el acuerdo y definir próximos pasos operativos.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Checklist</p>
                <ul className="mt-0.5 list-none space-y-0.5">
                  <li>☐ Respuesta del cliente registrada</li>
                  <li>☐ Próxima actividad agendada</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Tip de neuroventas</p>
                <p className="mt-0.5">Refuerza el beneficio ganado y reduce la incertidumbre post-compra.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Error común</p>
                <p className="mt-0.5">Desaparecer después de enviar la propuesta sin seguimiento.</p>
              </div>
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}
