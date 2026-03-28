"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { getLeadsOkMacroFlow, type LeadForLeadsOkMacro, type LeadsOkDocuments } from "@/lib/crm/leadsOkMacroFlow";
import {
  commercialStepHeroPrimaryLabel,
  getCommercialStepState,
  type CommercialStepState,
} from "@/lib/crm/getCommercialStepState";
import { getLeadProgress, getLeadStage, getLeadStageShortLabel } from "@/lib/crm/getLeadDerivedFlow";
import { alignMicroStepsWithMacro, getLeadsOkMicroFlow } from "@/lib/crm/leadsOkMicroFlow";
import {
  isPdfUrl,
  isLikelyEmbedBlocked,
  isTransientGammaExportPdfUrl,
  PRESENTATION_POPUP_FEATURES,
  PRESENTATION_POPUP_NAME,
  resolvePresentationResource,
} from "@/lib/leads/presentationUtils";
import {
  isGammaExternalOnlyUrl,
  isOfficialPresentationDocumentUrl,
  postRecoverLegacyDocuments,
} from "@/lib/leads/commercialGammaDocuments";
import { persistGammaCompletedStatus } from "@/lib/leads/mirrorGammaPdfClient";
import type {
  LeadDocumentArchiveEntry,
  LeadDocumentType,
  LeadDocumentVersionSummary,
} from "@/lib/leads/leadDocuments";
import { AiLeadReport } from "@/components/leads/AiLeadReport";
import { GuiaEstrategicaProceso } from "../components/GuiaEstrategicaProceso";
import { Leads87AdvancedWorkspace } from "../components/Leads87AdvancedWorkspace";
import { Leads87DiagnosticBlock } from "../components/Leads87DiagnosticBlock";
import { Leads87StrategyWorkspace } from "../components/Leads87StrategyWorkspace";
import {
  buildStrategyContextForServices,
  COMMERCIAL_STRATEGY_GATE_ERROR_MESSAGE,
  isCommercialStrategyApproved,
  parseCommercialStrategyStored,
} from "@/lib/crm/commercialStrategyFlow";
import { Leads87LeadDocumentsBlock } from "../components/Leads87LeadDocumentsBlock";
import RubroSelect from "../../empresas/RubroSelect";

const PROGRESS_STAGES = ["Lead", "Investigación", "Diagnóstico", "Estrategia", "Servicios", "Propuesta", "Presentación", "Cierre"];

/** Debe coincidir con la lectura en `app/admin/leads87/page.tsx`. */
const LEADS87_LIST_FLASH_KEY = "leads87_list_flash";

/**
 * Enlace auxiliar a Gamma (app o export PDF) cuando aún no hay documento oficial archivado.
 * No reemplaza file_url ni cuenta como URL oficial del CRM.
 */
function auxiliaryGammaOpenHref(entry: LeadDocumentArchiveEntry | null | undefined): string | null {
  if (!entry || entry.officialUrl?.trim()) return null;
  const g = entry.gammaUrl?.trim();
  if (g && (isGammaExternalOnlyUrl(g) || isTransientGammaExportPdfUrl(g))) return g;
  const r = entry.rawUrl?.trim();
  if (r && isGammaExternalOnlyUrl(r)) return r;
  if (r && isTransientGammaExportPdfUrl(r)) return r;
  return null;
}

const UNARCHIVED_GAMMA_HINT =
  "Este documento aún no está archivado en el CRM. Abrilo en Gamma y exportá el PDF para persistirlo.";

/** Acceso al documento oficial vs enlace secundario Gamma (solo UI; no altera getLeadDocuments ni flujo comercial). */
function Leads87CommercialDocAccessStrip(props: {
  label: string;
  entry: LeadDocumentArchiveEntry | undefined;
  onGenerate?: () => void;
  generateLabel?: string;
  generating?: boolean;
  /** Texto opcional (p. ej. versión vigente / conteo de historial). */
  versionHint?: string | null;
  /** `quiet`: mismo enlace pero sin competir visualmente con el CTA principal del workspace (p. ej. paso 5 en revisión). */
  openButtonVariant?: "prominent" | "quiet";
  openButtonLabel?: string;
}) {
  const {
    label,
    entry,
    onGenerate,
    generateLabel = "Generar",
    generating = false,
    versionHint = null,
    openButtonVariant = "prominent",
    openButtonLabel,
  } = props;
  const official = entry?.officialUrl?.trim() || null;
  const aux = auxiliaryGammaOpenHref(entry);
  const openLabel = openButtonLabel ?? "Abrir documento";

  if (official) {
    const quiet = openButtonVariant === "quiet";
    return (
      <div
        className={
          quiet
            ? "mb-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3"
            : "mb-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3"
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-slate-800">{label}</span>
          <a
            href={official}
            target="_blank"
            rel="noopener noreferrer"
            className={
              quiet
                ? "inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                : "inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            }
          >
            {openLabel}
          </a>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {quiet
            ? "Mismo documento que podés abrir desde el paso 2/3 del workspace de propuesta."
            : "Documento oficial en almacenamiento del CRM."}
        </p>
        {versionHint ? <p className="mt-1 text-xs text-slate-500">{versionHint}</p> : null}
      </div>
    );
  }

  if (aux) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3">
        <p className="text-sm text-amber-950">{UNARCHIVED_GAMMA_HINT}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={aux}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-950 shadow-sm hover:bg-amber-50"
          >
            Abrir en Gamma
          </a>
          {onGenerate ? (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {generating ? "Generando…" : generateLabel}
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-amber-900/80">
          <span className="font-medium">No oficial:</span> este enlace no reemplaza el archivado; el flujo comercial sigue
          cuando exista el PDF en el CRM.
        </p>
      </div>
    );
  }

  if (onGenerate) {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-700">{label}</span>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {generating ? "Generando…" : generateLabel}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function Leads87DetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params as { id?: string | string[] })?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId ?? null;

  const workspaceRef = useRef<HTMLDivElement>(null);
  /** Ancla del bloque de ejecución de la investigación (progreso), no el panel de módulos */
  const analysisExecutionRef = useRef<HTMLDivElement>(null);
  /** Ancla del Paso 2: bloque principal del diagnóstico comercial */
  const diagnosisExecutionRef = useRef<HTMLDivElement>(null);
  const fichaRef = useRef<HTMLDivElement>(null);
  /** Una vez por montaje de ficha: intento silencioso de archivado legacy (sin sessionStorage). */
  const legacyAutoRecoverAttemptedRef = useRef(false);
  const [fullLead, setFullLead] = useState<LeadForLeadsOkMacro | null>(null);
  const [documents, setDocuments] = useState<LeadsOkDocuments | null>(null);
  const [archiveByType, setArchiveByType] = useState<Record<LeadDocumentType, LeadDocumentArchiveEntry> | null>(null);
  const [documentVersionSummaries, setDocumentVersionSummaries] = useState<LeadDocumentVersionSummary[]>([]);
  const [loadingLead, setLoadingLead] = useState(true);
  const [leadLoadError, setLeadLoadError] = useState<string | null>(null);
  const [missingLeadContext, setMissingLeadContext] = useState<{
    checked: boolean;
    isEmpresaId: boolean;
    empresaNombre: string | null;
  }>({ checked: false, isEmpresaId: false, empresaNombre: null });
  const [activeWorkspaceStep, setActiveWorkspaceStep] = useState<number>(1);
  const [reportGeneratedLocally, setReportGeneratedLocally] = useState(false);
  const [completedStepOverrides, setCompletedStepOverrides] = useState<Record<number, boolean>>({});
  const [expandedStepId, setExpandedStepId] = useState<number>(1);
  const [fichaLeadOpen, setFichaLeadOpen] = useState(false);
  const [showProgreso, setShowProgreso] = useState(false);
  const [showFlujoMacro, setShowFlujoMacro] = useState(false);
  const [showBloquesAnalisis, setShowBloquesAnalisis] = useState(false);
  const [showGuiaPasos, setShowGuiaPasos] = useState(false);
  const [showLeadDocuments, setShowLeadDocuments] = useState(false);
  const [showGuiaEstrategica, setShowGuiaEstrategica] = useState(false);
  const [presentationGammaUrl, setPresentationGammaUrl] = useState<string | null>(null);
  const [presentationPdfUrl, setPresentationPdfUrl] = useState<string | null>(null);
  const [diagnosticGenLoading, setDiagnosticGenLoading] = useState(false);
  const [diagnosticGenProgress, setDiagnosticGenProgress] = useState(0);
  const [diagnosticGenEtaSeconds, setDiagnosticGenEtaSeconds] = useState<number | null>(null);
  const [diagnosticGenError, setDiagnosticGenError] = useState<string | null>(null);
  const [heroStageUpdating, setHeroStageUpdating] = useState(false);
  const [servicesConfirmReady, setServicesConfirmReady] = useState(false);
  const proposalCreateActionRef = useRef<(() => Promise<void>) | null>(null);
  const [proposalCreateReady, setProposalCreateReady] = useState(false);
  const [proposalCreateBusy, setProposalCreateBusy] = useState(false);
  const [proposalReviewPatchBusy, setProposalReviewPatchBusy] = useState(false);
  const [presentationGenerationBusy, setPresentationGenerationBusy] = useState(false);
  const [presentationGenerationStatus, setPresentationGenerationStatus] = useState<"idle" | "generating" | "completed" | "error">("idle");
  const [presentationGenerationProgress, setPresentationGenerationProgress] = useState(0);
  const [presentationGenerationEtaSeconds, setPresentationGenerationEtaSeconds] = useState<number | null>(null);
  const [presentationGenerationError, setPresentationGenerationError] = useState<string | null>(null);
  const [presentationCloseBusy, setPresentationCloseBusy] = useState(false);
  const [legacyRecoverBusy, setLegacyRecoverBusy] = useState(false);
  /** Mensaje amigable si el último intento de archivado dejó pendientes reales (sin detalle técnico). */
  const [legacyRecoverUserError, setLegacyRecoverUserError] = useState<string | null>(null);
  const [editingFicha, setEditingFicha] = useState(false);
  const [savingFicha, setSavingFicha] = useState(false);
  const [fichaError, setFichaError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  type FichaForm = {
    nombre: string;
    contacto: string;
    email: string;
    telefono: string;
    website: string;
    instagram: string;
    direccion: string;
    linkedin_empresa: string;
    linkedin_director: string;
    rubro_id: string | null;
    origen: string;
    objetivos: string;
    audiencia: string;
    tamano: string;
  };
  const [editForm, setEditForm] = useState<FichaForm>({
    nombre: "",
    contacto: "",
    email: "",
    telefono: "",
    website: "",
    instagram: "",
    direccion: "",
    linkedin_empresa: "",
    linkedin_director: "",
    rubro_id: null,
    origen: "",
    objetivos: "",
    audiencia: "",
    tamano: "",
  });

  const docVersionHistoryHints = useMemo(() => {
    const out: Partial<Record<LeadDocumentType, string>> = {};
    const types: LeadDocumentType[] = ["diagnostic", "strategy", "proposal", "presentation"];
    for (const t of types) {
      const rows = documentVersionSummaries.filter((r) => r.type === t);
      if (rows.length <= 1) continue;
      const cur = rows.find((r) => r.is_current);
      if (cur) out[t] = `Versión vigente: v${cur.version_number} · ${rows.length} versiones en CRM`;
    }
    return out;
  }, [documentVersionSummaries]);

  const goToWorkspace = useCallback((stepId: number) => {
    setActiveWorkspaceStep(stepId);
    setExpandedStepId(stepId);
    const delay = stepId === 1 ? 120 : stepId === 2 ? 100 : 0;
    setTimeout(() => {
      if (stepId === 1 && analysisExecutionRef.current) {
        analysisExecutionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (stepId === 2 && diagnosisExecutionRef.current) {
        diagnosisExecutionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, delay);
  }, []);

  useEffect(() => {
    if (!id?.trim()) {
      setFullLead(null);
      setDocuments(null);
      setArchiveByType(null);
      setDocumentVersionSummaries([]);
      setLeadLoadError(null);
      setMissingLeadContext({ checked: false, isEmpresaId: false, empresaNombre: null });
      setLoadingLead(false);
      return;
    }
    let cancelled = false;
    setLoadingLead(true);
    setLeadLoadError(null);
    Promise.all([
      fetch(`/api/admin/leads/${id}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/leads/${id}/documents`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([leadRes, docsRes]) => {
        if (cancelled) return;
        if (leadRes && typeof leadRes === "object" && typeof (leadRes as { error?: unknown }).error === "string") {
          const msg = String((leadRes as { error?: string }).error).trim();
          if (msg.length > 0) setLeadLoadError(msg);
        }
        const nextLead = (leadRes?.data ?? null) as LeadForLeadsOkMacro | null;
        setFullLead(nextLead);
        setDocuments(docsRes?.ok && docsRes?.documents ? docsRes.documents : null);
        setArchiveByType(
          docsRes?.ok && docsRes?.archiveByType
            ? (docsRes.archiveByType as Record<LeadDocumentType, LeadDocumentArchiveEntry>)
            : null
        );
        if (docsRes?.ok && Array.isArray(docsRes.versionSummaries)) {
          setDocumentVersionSummaries(docsRes.versionSummaries as LeadDocumentVersionSummary[]);
        } else {
          setDocumentVersionSummaries([]);
        }
        if (nextLead) {
          setMissingLeadContext({ checked: true, isEmpresaId: false, empresaNombre: null });
          return;
        }
        fetch(`/api/admin/empresas/${id}`, { cache: "no-store" })
          .then((r) => r.json().catch(() => ({})))
          .then((empresaRes) => {
            if (cancelled) return;
            const empresaNombre =
              typeof empresaRes?.data?.nombre === "string" ? empresaRes.data.nombre.trim() : null;
            const isEmpresaId = Boolean(empresaRes?.data?.id);
            setMissingLeadContext({
              checked: true,
              isEmpresaId,
              empresaNombre: empresaNombre || null,
            });
          })
          .catch(() => {
            if (!cancelled) {
              setMissingLeadContext({ checked: true, isEmpresaId: false, empresaNombre: null });
            }
          });
      })
      .catch(() => {
        if (!cancelled) {
          setFullLead(null);
          setDocuments(null);
          setArchiveByType(null);
          setDocumentVersionSummaries([]);
          setLeadLoadError("No se pudo cargar el lead.");
          setMissingLeadContext({ checked: true, isEmpresaId: false, empresaNombre: null });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLead(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id) setReportGeneratedLocally(false);
  }, [id]);

  useEffect(() => {
    setPresentationGenerationStatus("idle");
    setPresentationGenerationProgress(0);
    setPresentationGenerationEtaSeconds(null);
    setPresentationGenerationError(null);
  }, [id]);

  useEffect(() => {
    setDiagnosticGenProgress(0);
    setDiagnosticGenEtaSeconds(null);
  }, [id]);

  useEffect(() => {
    setCompletedStepOverrides({});
  }, [id]);

  useEffect(() => {
    setLegacyRecoverUserError(null);
  }, [id]);

  useEffect(() => {
    legacyAutoRecoverAttemptedRef.current = false;
  }, [id]);

  const effectiveLead = useMemo(() => {
    if (!fullLead) return fullLead;
    if (reportGeneratedLocally && !fullLead.ai_report?.trim()) {
      return { ...fullLead, ai_report: " " } as LeadForLeadsOkMacro;
    }
    return fullLead;
  }, [fullLead, reportGeneratedLocally]);

  /** Lead + documentos con los mismos overrides optimistas que el hero, para una sola fuente de verdad. */
  const leadForUnifiedFlow = useMemo((): LeadForLeadsOkMacro | null => {
    if (!effectiveLead) return null;
    let l = { ...effectiveLead };
    if (completedStepOverrides[1] && !String(l.ai_report ?? "").trim()) {
      l = { ...l, ai_report: " " };
    }
    return l;
  }, [effectiveLead, completedStepOverrides]);

  const documentsForUnifiedFlow = useMemo((): LeadsOkDocuments | null => {
    const fromLeadProposal = String(
      (leadForUnifiedFlow as { proposal_doc_url?: string | null } | null)?.proposal_doc_url ?? ""
    ).trim();
    const fromLeadPresentation = String(
      (leadForUnifiedFlow as { presentation_doc_url?: string | null } | null)?.presentation_doc_url ?? ""
    ).trim();
    if (!documents && !fromLeadProposal && !fromLeadPresentation) return null;
    const d = { ...(documents ?? {}) } as LeadsOkDocuments;
    if (completedStepOverrides[2] && !String(d.diagnostic ?? "").trim()) {
      d.diagnostic = " ";
    }
    if (completedStepOverrides[3] && !String(d.strategy ?? "").trim()) {
      d.strategy = " ";
    }
    const prop = fromLeadProposal || String(d.proposal ?? "").trim() || null;
    const pres = fromLeadPresentation || String(d.presentation ?? "").trim() || null;
    d.proposal = prop ?? d.proposal ?? null;
    d.presentation = pres ?? d.presentation ?? null;
    return d;
  }, [documents, leadForUnifiedFlow, completedStepOverrides]);

  /** URLs reales persistidas (sin overrides del stepper) para detectar Gamma efímera legacy. */
  const urlsForLegacyGammaCheck = useMemo((): LeadsOkDocuments | null => {
    if (!documents && !fullLead) return null;
    const d = { ...(documents ?? {}) } as LeadsOkDocuments;
    const fl = fullLead as { proposal_doc_url?: string | null; presentation_doc_url?: string | null } | null;
    const p = fl?.proposal_doc_url?.trim();
    const pr = fl?.presentation_doc_url?.trim();
    if (p) d.proposal = p;
    if (pr) d.presentation = pr;
    return d;
  }, [documents, fullLead]);

  const legacyGammaTransientTypes = useMemo(() => {
    const types = ["diagnostic", "strategy", "proposal", "presentation"] as const;
    const out: LeadDocumentType[] = [];
    if (archiveByType) {
      for (const t of types) {
        const a = archiveByType[t];
        if (
          a?.status === "pending" &&
          (isTransientGammaExportPdfUrl(a.rawUrl ?? "") || isTransientGammaExportPdfUrl(a.gammaUrl ?? ""))
        ) {
          out.push(t);
        }
      }
      return out;
    }
    if (!urlsForLegacyGammaCheck) return [];
    for (const t of types) {
      const u = urlsForLegacyGammaCheck[t]?.trim();
      if (u && isTransientGammaExportPdfUrl(u)) out.push(t);
    }
    return out;
  }, [archiveByType, urlsForLegacyGammaCheck]);

  const commercialState: CommercialStepState = useMemo(
    () => getCommercialStepState(leadForUnifiedFlow, documentsForUnifiedFlow),
    [leadForUnifiedFlow, documentsForUnifiedFlow]
  );

  const strategyFlowApproved = useMemo(
    () => isCommercialStrategyApproved(leadForUnifiedFlow, documentsForUnifiedFlow),
    [leadForUnifiedFlow, documentsForUnifiedFlow]
  );

  useEffect(() => {
    if (strategyFlowApproved && diagnosticGenError === COMMERCIAL_STRATEGY_GATE_ERROR_MESSAGE) {
      setDiagnosticGenError(null);
    }
  }, [strategyFlowApproved, diagnosticGenError]);

  const strategyContextForServices = useMemo(() => {
    const raw = (leadForUnifiedFlow as { commercial_strategy_json?: unknown } | null)?.commercial_strategy_json;
    const st = parseCommercialStrategyStored(raw);
    return buildStrategyContextForServices(st);
  }, [leadForUnifiedFlow]);

  /** Misma derivación que la lista LEADS87 (getLeadStage / getLeadProgress). */
  const heroMacroFlowSnapshot = useMemo(() => {
    const stage = getLeadStage(leadForUnifiedFlow, documentsForUnifiedFlow);
    return {
      stage,
      progress: getLeadProgress(stage),
      label: getLeadStageShortLabel(stage),
    };
  }, [leadForUnifiedFlow, documentsForUnifiedFlow]);

  const isInvestigationCompleted = Boolean(
    String(leadForUnifiedFlow?.ai_report ?? "").trim().length > 0 || reportGeneratedLocally || completedStepOverrides[1]
  );
  const diagnosticUrl = String(documentsForUnifiedFlow?.diagnostic ?? documents?.diagnostic ?? "").trim();
  const diagnosticDocument = documentsForUnifiedFlow?.diagnostic ?? documents?.diagnostic ?? null;
  const isDiagnosticCompleted = Boolean(diagnosticUrl || diagnosticDocument);

  const macroStages = useMemo(
    () => getLeadsOkMacroFlow(leadForUnifiedFlow, documentsForUnifiedFlow),
    [leadForUnifiedFlow, documentsForUnifiedFlow]
  );

  const microStepsBase = useMemo(
    () => getLeadsOkMicroFlow(leadForUnifiedFlow, documentsForUnifiedFlow),
    [leadForUnifiedFlow, documentsForUnifiedFlow]
  );

  const microSteps = useMemo(
    () => alignMicroStepsWithMacro(microStepsBase, macroStages),
    [microStepsBase, macroStages]
  );

  const firstIncompleteMacroIndex = macroStages.findIndex((s) => s.status !== "completed");
  const allMacroStagesComplete = macroStages.length > 0 && firstIncompleteMacroIndex === -1;
  const activeMacroStageId = allMacroStagesComplete ? null : (macroStages[firstIncompleteMacroIndex]?.id ?? null);
  const rawServicesConfirmed = (leadForUnifiedFlow as { services_confirmed?: unknown } | null)?.services_confirmed;
  const servicesStructureConfirmed =
    typeof rawServicesConfirmed === "boolean"
      ? rawServicesConfirmed
      : Boolean((leadForUnifiedFlow as { proposal_confirmed_at?: string | null } | null)?.proposal_confirmed_at?.trim());
  const effectiveActiveMacroStageId = useMemo(() => {
    if (activeMacroStageId == null) return null;
    if (!servicesStructureConfirmed && activeMacroStageId >= 6) return 5;
    return activeMacroStageId;
  }, [activeMacroStageId, servicesStructureConfirmed]);
  /** 0–7 = etapa activa; 8 = todas completadas (stepper: todo en verde, sin punto activo). */
  const stepperStageIndex = effectiveActiveMacroStageId == null ? PROGRESS_STAGES.length : Math.max(0, effectiveActiveMacroStageId - 1);
  const flowActiveMicroStepId = useMemo((): number | null => {
    if (effectiveActiveMacroStageId == null) return null;
    if (effectiveActiveMacroStageId <= 2) return 1;
    if (effectiveActiveMacroStageId === 3) return 2;
    if (effectiveActiveMacroStageId === 4) return 3;
    if (effectiveActiveMacroStageId === 5) return 4;
    if (effectiveActiveMacroStageId === 6) return 5;
    return 6;
  }, [effectiveActiveMacroStageId]);
  const gatedFlowMicroStepId = useMemo((): number | null => {
    if (flowActiveMicroStepId == null) return null;
    /** Sin estrategia confirmada no mostrar workspace de servicios (paso 4) ni posteriores por número de paso. */
    if (!strategyFlowApproved && flowActiveMicroStepId >= 4) return 3;
    if (!servicesStructureConfirmed && flowActiveMicroStepId >= 5) return 4;
    /** Monótono: con estructura confirmada no volver a pasos 1–4 aunque macro/align discrepen un momento. */
    if (servicesStructureConfirmed && flowActiveMicroStepId < 5) return 5;
    return flowActiveMicroStepId;
  }, [flowActiveMicroStepId, servicesStructureConfirmed, strategyFlowApproved]);

  const blockingMacroStage =
    effectiveActiveMacroStageId == null ? null : macroStages.find((s) => s.id === effectiveActiveMacroStageId) ?? null;

  const currentMicroStep = useMemo(
    () => microSteps.find((s) => s.status !== "completed") ?? null,
    [microSteps]
  );
  const activeMicro = useMemo(
    () => microSteps.find((s) => s.status === "active") ?? currentMicroStep,
    [microSteps, currentMicroStep]
  );

  useEffect(() => {
    if (gatedFlowMicroStepId != null) {
      setActiveWorkspaceStep(gatedFlowMicroStepId);
      setExpandedStepId(gatedFlowMicroStepId);
    } else {
      setActiveWorkspaceStep(6);
      setExpandedStepId(6);
    }
  }, [id, gatedFlowMicroStepId]);

  const refetchLead = useCallback(async () => {
    if (!id?.trim()) return;
    const [leadRes, docsRes] = await Promise.all([
      fetch(`/api/admin/leads/${id}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/leads/${id}/documents`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    const nextLead = (leadRes?.data ?? null) as LeadForLeadsOkMacro | null;
    const nextDocs = docsRes?.ok && docsRes?.documents ? docsRes.documents : null;
    setFullLead(nextLead);
    setDocuments(nextDocs);
    setArchiveByType(
      docsRes?.ok && docsRes?.archiveByType
        ? (docsRes.archiveByType as Record<LeadDocumentType, LeadDocumentArchiveEntry>)
        : null
    );
    if (docsRes?.ok && Array.isArray(docsRes.versionSummaries)) {
      setDocumentVersionSummaries(docsRes.versionSummaries as LeadDocumentVersionSummary[]);
    } else {
      setDocumentVersionSummaries([]);
    }
    if ((leadRes?.data as LeadForLeadsOkMacro)?.ai_report?.trim()) setReportGeneratedLocally(false);

    // El paso visible del workspace lo fija solo `gatedFlowMicroStepId` + useEffect([id, gatedFlowMicroStepId]).
    // No recalcular aquí con alignMicroStepsWithMacro: tras confirmar servicios podía marcar paso 3 activo
    // (macro vs URL oficial de estrategia) y pisar el avance a propuesta.
  }, [id]);

  const handleRecoverLegacyGammaDocs = useCallback(async () => {
    if (!id?.trim()) return;
    setLegacyRecoverBusy(true);
    setLegacyRecoverUserError(null);
    try {
      const json = await postRecoverLegacyDocuments(id.trim());
      if (!json.ok) {
        setLegacyRecoverUserError("No se pudo iniciar el archivado. Reintentá en unos segundos.");
        return;
      }
      const failed = (json.results ?? []).filter((r) => r.status === "failed");
      await refetchLead();
      if (failed.length > 0) {
        setLegacyRecoverUserError(
          "Algunos documentos no se archivaron (enlace expirado o error de red). Reintentá o volvé a generarlos desde el paso correspondiente."
        );
      }
    } catch {
      setLegacyRecoverUserError("No se pudo conectar para archivar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setLegacyRecoverBusy(false);
    }
  }, [id, refetchLead]);

  /** Una vez por montaje: si hay Gamma efímera pendiente, intenta archivar sin bloquear la UI. */
  useEffect(() => {
    if (typeof window === "undefined" || !id?.trim() || loadingLead) return;
    if (legacyGammaTransientTypes.length === 0) return;
    if (legacyAutoRecoverAttemptedRef.current) return;
    legacyAutoRecoverAttemptedRef.current = true;
    console.info("[LEADS87] auto recuperación legacy (una vez por carga)", { leadId: id.trim() });
    void (async () => {
      try {
        const json = await postRecoverLegacyDocuments(id.trim());
        if (json.ok && (json.summary?.archived ?? 0) > 0) {
          await refetchLead();
        }
      } catch (e) {
        console.warn("[LEADS87] auto recuperación legacy", e);
      }
    })();
  }, [id, loadingLead, legacyGammaTransientTypes.length, refetchLead]);

  const handleReportGenerated = useCallback(async () => {
    setReportGeneratedLocally(true);
    if (activeWorkspaceStep >= 1 && activeWorkspaceStep <= 3) {
      setCompletedStepOverrides((prev) => ({ ...prev, [activeWorkspaceStep]: true }));
    }
    await refetchLead();
  }, [refetchLead, activeWorkspaceStep]);

  /** Paso 2: Gamma diagnóstico + scroll al bloque principal (llamar desde el CTA). */
  const handleGenerateDiagnosticCommercial = useCallback(() => {
    diagnosisExecutionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void (async () => {
      if (!id?.trim()) return;
      setDiagnosticGenLoading(true);
      setDiagnosticGenError(null);
      setDiagnosticGenProgress(5);
      setDiagnosticGenEtaSeconds(null);
      try {
        const res = await fetch(`/api/admin/leads/${id}/gamma-diagnostic`, { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { error?: string })?.error ?? "Error generando diagnóstico");
        const generationId =
          typeof (json as { generationId?: string })?.generationId === "string"
            ? (json as { generationId: string }).generationId
            : null;
        if (!generationId) throw new Error("No se pudo iniciar la generación del diagnóstico.");
        let completed = false;
        const totalPolls = 45;
        const pollIntervalSeconds = 4;
        const startedAt = Date.now();
        for (let i = 0; i < totalPolls; i++) {
          const progress = Math.min(95, Math.round(((i + 1) / totalPolls) * 100));
          setDiagnosticGenProgress(progress);
          if (progress > 15) {
            const elapsed = (Date.now() - startedAt) / 1000;
            const totalEstimated = elapsed / (progress / 100);
            const remaining = Math.max(0, totalEstimated - elapsed);
            setDiagnosticGenEtaSeconds(Math.round(remaining));
          } else {
            setDiagnosticGenEtaSeconds((totalPolls - (i + 1)) * pollIntervalSeconds);
          }
          const statusRes = await fetch(
            `/api/admin/leads/${id}/gamma-proposal/status?generationId=${encodeURIComponent(generationId)}`
          );
          const statusJson = await statusRes.json().catch(() => ({}));
          if (statusJson?.status === "completed") {
            completed = true;
            setDiagnosticGenProgress(100);
            setDiagnosticGenEtaSeconds(0);
            const persisted = await persistGammaCompletedStatus(id.trim(), "diagnostic", generationId, {
              pdfUrl: statusJson?.pdfUrl ?? null,
              gammaUrl: statusJson?.gammaUrl ?? null,
            });
            if (persisted.error) {
              setDiagnosticGenError(persisted.error);
            } else if (persisted.pendingMessage) {
              setDiagnosticGenError(persisted.pendingMessage);
            } else {
              setDiagnosticGenError(null);
            }
            await refetchLead();
            const openUrl = persisted.crmArchivedUrl || persisted.openUrl;
            if (openUrl) window.open(openUrl, "_blank");
            break;
          }
          if (statusJson?.status === "failed") throw new Error("Gamma no pudo completar el diagnóstico.");
          await new Promise((r) => setTimeout(r, pollIntervalSeconds * 1000));
        }
        if (!completed) {
          setDiagnosticGenError("Gamma sigue procesando. Podés revisar el estado en unos minutos.");
        }
      } catch (e) {
        setDiagnosticGenError(e instanceof Error ? e.message : "Error generando diagnóstico");
      } finally {
        setDiagnosticGenLoading(false);
        setDiagnosticGenProgress(0);
        setDiagnosticGenEtaSeconds(null);
      }
    })();
  }, [id, refetchLead]);

  const handleStepAction = useCallback(
    (stepId: number) => {
      if (stepId === 6 && documentsForUnifiedFlow) {
        const primaryUrl = resolvePresentationResource(
          documentsForUnifiedFlow,
          presentationGammaUrl,
          presentationPdfUrl
        ).openUrl;
        if (primaryUrl && isLikelyEmbedBlocked(primaryUrl)) {
          window.open(primaryUrl, PRESENTATION_POPUP_NAME, PRESENTATION_POPUP_FEATURES);
        }
      }
      goToWorkspace(stepId);
    },
    [documentsForUnifiedFlow, goToWorkspace, presentationGammaUrl, presentationPdfUrl]
  );

  const moveToServicesFromHero = useCallback(async () => {
    if (!id?.trim()) return;
    if (!strategyFlowApproved) {
      goToWorkspace(3);
      requestAnimationFrame(() => {
        document.getElementById("leads87-strategy-block")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      setDiagnosticGenError(COMMERCIAL_STRATEGY_GATE_ERROR_MESSAGE);
      return;
    }
    setHeroStageUpdating(true);
    try {
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ pipeline: "Servicios" }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json?.error ?? "No se pudo actualizar la etapa.");
      }

      await refetchLead();
      setActiveWorkspaceStep(4);
      setExpandedStepId(4);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo actualizar la etapa.";
      setDiagnosticGenError(message);
    } finally {
      setHeroStageUpdating(false);
    }
  }, [id, refetchLead, strategyFlowApproved, goToWorkspace]);

  const markProposalReviewed = useCallback(async () => {
    if (!id?.trim()) return;
    const url = String(documentsForUnifiedFlow?.proposal ?? "").trim();
    if (!url) return;
    setProposalReviewPatchBusy(true);
    setDiagnosticGenError(null);
    try {
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          proposal_reviewed: true,
          pipeline: "Presentación",
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json?.error ?? "No se pudo guardar la revisión de la propuesta.");
      }
      await refetchLead();
      goToWorkspace(6);
    } catch (e) {
      setDiagnosticGenError(e instanceof Error ? e.message : "No se pudo confirmar la revisión.");
    } finally {
      setProposalReviewPatchBusy(false);
    }
  }, [id, documentsForUnifiedFlow?.proposal, refetchLead, goToWorkspace]);

  const generatePresentationCommercial = useCallback(async () => {
    if (!id?.trim()) return;
    const cs = getCommercialStepState(fullLead as Parameters<typeof getCommercialStepState>[0], documentsForUnifiedFlow);
    if (cs !== "ready_for_presentation") {
      setDiagnosticGenError("Primero confirmá la revisión de la propuesta comercial en el paso 5.");
      return;
    }
    setPresentationGenerationBusy(true);
    setPresentationGenerationStatus("generating");
    setPresentationGenerationProgress(5);
    setPresentationGenerationEtaSeconds(null);
    setPresentationGenerationError(null);
    setDiagnosticGenError(null);
    try {
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(id)}/gamma-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ profile: "comercial" }),
      });
      const json = (await res.json().catch(() => ({}))) as { generationId?: string; error?: string };
      if (!res.ok) throw new Error(json?.error ?? "No se pudo iniciar la generación de la presentación.");
      const generationId = typeof json?.generationId === "string" ? json.generationId : null;
      if (!generationId) throw new Error("No se recibió generationId para la presentación.");

      let completed = false;
      const totalPolls = 45;
      const pollIntervalSeconds = 4;
      const startedAt = Date.now();
      for (let i = 0; i < 45; i++) {
        const progress = Math.min(95, Math.round(((i + 1) / totalPolls) * 100));
        setPresentationGenerationProgress(progress);
        if (progress > 15) {
          const elapsed = (Date.now() - startedAt) / 1000;
          const totalEstimated = elapsed / (progress / 100);
          const remaining = Math.max(0, totalEstimated - elapsed);
          setPresentationGenerationEtaSeconds(Math.round(remaining));
        } else {
          setPresentationGenerationEtaSeconds((totalPolls - (i + 1)) * pollIntervalSeconds);
        }
        const statusRes = await fetch(
          `/api/admin/leads/${encodeURIComponent(id)}/gamma-proposal/status?generationId=${encodeURIComponent(generationId)}`
        );
        const statusJson = (await statusRes.json().catch(() => ({}))) as {
          status?: string;
          gammaUrl?: string | null;
          pdfUrl?: string | null;
        };
        if (statusJson?.status === "completed") {
          completed = true;
          const gamma = statusJson?.gammaUrl?.trim() || null;
          const pdf = statusJson?.pdfUrl?.trim() || null;

          const persisted = await persistGammaCompletedStatus(id.trim(), "presentation", generationId, {
            pdfUrl: statusJson.pdfUrl ?? null,
            gammaUrl: statusJson.gammaUrl ?? null,
          });

          const urlToSave = persisted.crmArchivedUrl;
          if (gamma) setPresentationGammaUrl(gamma);
          else setPresentationGammaUrl(null);
          setPresentationPdfUrl(null);

          if (persisted.error) {
            setPresentationGenerationError(persisted.error);
            setPresentationGenerationStatus("error");
            setDiagnosticGenError(persisted.error);
          } else if (persisted.pendingMessage) {
            setPresentationGenerationStatus("completed");
            setPresentationGenerationError(null);
            setDiagnosticGenError(persisted.pendingMessage);
          } else {
            setPresentationGenerationStatus("completed");
            setPresentationGenerationError(null);
            setDiagnosticGenError(null);
          }

          await refetchLead();
          const mergedDocs: LeadsOkDocuments | null = documents
            ? { ...documents, ...(urlToSave ? { presentation: urlToSave } : {}) }
            : urlToSave
              ? { presentation: urlToSave }
              : documents;
          const resolved = resolvePresentationResource(mergedDocs, gamma, pdf);
          setPresentationGenerationProgress(100);
          setPresentationGenerationEtaSeconds(0);
          const stableOpen =
            (urlToSave && isOfficialPresentationDocumentUrl(urlToSave) ? urlToSave : null) ||
            persisted.crmArchivedUrl ||
            resolved.presentationDocumentUrl ||
            resolved.pdfUrl ||
            resolved.fallbackLinkedUrl ||
            persisted.openUrl;
          if (stableOpen) window.open(stableOpen, "_blank");
          break;
        }
        if (statusJson?.status === "failed") {
          throw new Error("Gamma no pudo completar la presentación.");
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
      if (!completed) {
        throw new Error("Gamma sigue procesando. Podés reintentar abrir estado en unos minutos.");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error generando presentación comercial.";
      setDiagnosticGenError(message);
      setPresentationGenerationStatus("error");
      setPresentationGenerationError(message);
      setPresentationGenerationEtaSeconds(null);
    } finally {
      setPresentationGenerationBusy(false);
    }
  }, [id, documents, documentsForUnifiedFlow, fullLead, refetchLead]);

  const openPresentationFromHero = useCallback(() => {
    const resolved = resolvePresentationResource(documentsForUnifiedFlow, presentationGammaUrl, presentationPdfUrl);
    const stable =
      (resolved.presentationDocumentUrl && isOfficialPresentationDocumentUrl(resolved.presentationDocumentUrl)
        ? resolved.presentationDocumentUrl
        : null) ||
      resolved.pdfUrl ||
      resolved.fallbackLinkedUrl ||
      null;
    if (stable) {
      window.open(stable, "_blank");
      return;
    }
    if (resolved.temporaryPdfUrl) {
      setDiagnosticGenError(
        "Hay un PDF de exportación Gamma que aún no se archivó en el CRM. Usá «Generar presentación» de nuevo o el informe IA para completar el archivado."
      );
      return;
    }
    if (resolved.gammaUrl) {
      setDiagnosticGenError(
        "Solo hay enlace a la app Gamma (no archivado). Exportá PDF desde Gamma y generá de nuevo para guardar la URL en almacenamiento propio."
      );
      return;
    }
    setDiagnosticGenError("Todavía no existe una presentación archivada para abrir.");
  }, [presentationGammaUrl, presentationPdfUrl, documentsForUnifiedFlow]);

  const moveToCloseFromPresentation = useCallback(async () => {
    console.debug("[LEADS87][STEP6] moveToCloseFromPresentation:start", {
      leadId: id,
      commercialState,
      hasPresentationDoc: Boolean(documentsForUnifiedFlow?.presentation?.trim()),
    });
    if (!id?.trim()) {
      setDiagnosticGenError("No se encontró el ID del lead para finalizar el proceso.");
      return;
    }
    setPresentationCloseBusy(true);
    setDiagnosticGenError(null);
    try {
      const nowIso = new Date().toISOString();
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          commercial_stage: "closing",
          stage: "closing",
          pipeline: "Seguimiento",
          proposal_sent_at: nowIso,
        }),
      });
      console.debug("[LEADS87][STEP6] moveToCloseFromPresentation:patch_response", { ok: res.ok, status: res.status });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json?.error ?? "No se pudo avanzar a cierre.");
      }
      await refetchLead();
      console.debug("[LEADS87][STEP6] moveToCloseFromPresentation:success_redirect", { to: `/admin/leads/${encodeURIComponent(id)}?tab=acciones` });
      router.push(`/admin/leads/${encodeURIComponent(id)}?tab=acciones`);
    } catch (e) {
      setDiagnosticGenError(e instanceof Error ? e.message : "No se pudo avanzar a cierre.");
    } finally {
      setPresentationCloseBusy(false);
    }
  }, [id, commercialState, documentsForUnifiedFlow?.presentation, refetchLead, router]);

  const startEditingFicha = useCallback(() => {
    if (!fullLead) return;
    const lead = fullLead as LeadForLeadsOkMacro & {
      empresa_id?: string | null;
      empresas?: {
        id?: string;
        nombre?: string | null;
        rubro_id?: string | null;
        web?: string | null;
        instagram?: string | null;
        direccion?: string | null;
        rubros?: { id?: string | null } | null;
      } | null;
      website?: string | null;
      instagram?: string | null;
      direccion?: string | null;
      linkedin_empresa?: string | null;
      linkedin_director?: string | null;
      origen?: string | null;
      objetivos?: string | null;
      audiencia?: string | null;
      tamano?: string | null;
    };
    const emp = lead.empresas;
    setEditForm({
      nombre: (lead.nombre ?? emp?.nombre ?? "").trim(),
      contacto: (lead.contacto ?? "").trim(),
      email: (lead.email ?? "").trim(),
      telefono: (lead.telefono ?? "").trim(),
      website: (lead.website ?? emp?.web ?? "").trim(),
      instagram: (lead.instagram ?? emp?.instagram ?? "").trim(),
      direccion: (lead.direccion ?? emp?.direccion ?? "").trim(),
      linkedin_empresa: (lead.linkedin_empresa ?? "").trim(),
      linkedin_director: (lead.linkedin_director ?? "").trim(),
      rubro_id: emp?.rubro_id ?? (emp as { rubros?: { id?: string | null } | null })?.rubros?.id ?? null,
      origen: (lead.origen ?? "").trim(),
      objetivos: (lead.objetivos ?? "").trim(),
      audiencia: (lead.audiencia ?? "").trim(),
      tamano: (lead.tamano ?? "").trim(),
    });
    setEditingFicha(true);
    setFichaError(null);
  }, [fullLead]);

  const saveFicha = useCallback(async () => {
    if (!id?.trim() || !fullLead?.id) return;
    setSavingFicha(true);
    setFichaError(null);
    try {
      const body: Record<string, string | null> = {
        nombre: editForm.nombre.trim() || null,
        contacto: editForm.contacto.trim() || null,
        email: editForm.email.trim() || null,
        telefono: editForm.telefono.trim() || null,
        website: editForm.website.trim() || null,
        instagram: editForm.instagram.trim() || null,
        direccion: editForm.direccion.trim() || null,
        linkedin_empresa: editForm.linkedin_empresa.trim() || null,
        linkedin_director: editForm.linkedin_director.trim() || null,
        origen: editForm.origen.trim() || null,
        objetivos: editForm.objetivos.trim() || null,
        audiencia: editForm.audiencia.trim() || null,
        tamano: editForm.tamano.trim() || null,
      };
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(body),
      });
      let json = (await res.json()) as { data?: unknown; error?: string };
      let leadPatchOk = res.ok;
      if (!leadPatchOk) {
        const err = String(json?.error ?? "").toLowerCase();
        const missingLeadColumn =
          err.includes("could not find the 'direccion' column of 'leads'") ||
          err.includes("could not find the 'instagram' column of 'leads'");
        if (missingLeadColumn) {
          const fallbackBody = { ...body };
          delete (fallbackBody as { direccion?: string | null }).direccion;
          delete (fallbackBody as { instagram?: string | null }).instagram;
          const fallbackRes = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
            body: JSON.stringify(fallbackBody),
          });
          json = (await fallbackRes.json()) as { data?: unknown; error?: string };
          leadPatchOk = fallbackRes.ok;
        }
      }
      if (!leadPatchOk) {
        setFichaError(json?.error ?? "Error al guardar");
        return;
      }
      const empresaId = (fullLead as { empresa_id?: string | null; empresas?: { id?: string } | null }).empresa_id ?? (fullLead as { empresas?: { id?: string } | null }).empresas?.id;
      if (empresaId) {
        const rubroIdToSave = (editForm.rubro_id && String(editForm.rubro_id).trim()) || null;
        const empRes = await fetch(`/api/admin/empresas/${encodeURIComponent(empresaId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({
            nombre: editForm.nombre.trim() || null,
            rubro_id: rubroIdToSave,
            email: editForm.email.trim() || null,
            telefono: editForm.telefono.trim() || null,
            web: editForm.website.trim() || null,
            instagram: editForm.instagram.trim() || null,
            direccion: editForm.direccion.trim() || null,
            contacto_nombre: editForm.contacto.trim() || null,
          }),
        });
        if (!empRes.ok) {
          const empJson = (await empRes.json()) as { error?: string };
          setFichaError(empJson?.error ?? "Error al guardar datos de la entidad vinculada");
          return;
        }
      }
      setEditingFicha(false);
      refetchLead();
    } catch (e) {
      setFichaError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingFicha(false);
    }
  }, [id, fullLead, editForm, refetchLead]);

  const goToFichaAndEdit = useCallback(() => {
    setFichaLeadOpen(true);
    setEditingFicha(false);
    startEditingFicha();
    setTimeout(() => fichaRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [startEditingFicha]);

  const leadDisplayName = (fullLead?.nombre?.trim() || fullLead?.empresas?.nombre?.trim() || id || "—") as string;
  /** Caso real reportado: investigación + diagnóstico completos => foco debe saltar al paso 3. */
  const shouldForceFlowProgress = isInvestigationCompleted && isDiagnosticCompleted;
  const missingInCurrentStep = (blockingMacroStage?.checklist ?? []).filter((i) => !i.done).map((i) => i.label);
  /** Datos de ficha insuficientes: prioridad sobre el resto del flujo. */
  const hasBlocking = missingInCurrentStep.length > 0;
  const analisisCompleto = microSteps.some((s) => s.id === 1 && s.status === "completed");
  const diagnosticoCompleto = microSteps.some((s) => s.id === 2 && s.status === "completed");
  const actionByStepId: Record<number, string> = {
    1: "Generar investigación comercial",
    2: "Generar diagnóstico comercial (3/3)",
    3: "Avanzar a estrategia comercial",
    4: "Definir propuesta de servicios",
    5: "Crear propuesta",
    6: "Presentación comercial y cierre",
  };
  /** Regla del Hero: siempre primer paso micro realmente incompleto. */
  const nextIncompleteMicroStepId = useMemo(
    () => gatedFlowMicroStepId,
    [gatedFlowMicroStepId]
  );
  const ctaMicroStepId =
    (hasBlocking && !shouldForceFlowProgress) || (allMacroStagesComplete && servicesStructureConfirmed)
      ? null
      : nextIncompleteMicroStepId;

  const isProcessComplete = allMacroStagesComplete && servicesStructureConfirmed;

  const nextStepAfterAnalysis = microSteps.find((s) => s.id > 1 && s.status !== "completed")?.id ?? 2;
  const secondaryActionByStepId: Record<number, string> = {
    2: "Revisar diagnóstico",
    3: "Revisar estrategia",
    4: "Revisar estructura de servicios",
    5: "Revisar propuesta comercial",
    6: "Revisar presentación comercial",
  };
  const nextAfterAnalysisLabel = secondaryActionByStepId[nextStepAfterAnalysis] ?? "Continuar al siguiente paso";
  const nextAfterDiagnosticLabel = secondaryActionByStepId[3] ?? "Ir a estrategia de crecimiento";

  /** CTA del hero: solo "Proceso completo" cuando las 8 etapas macro están cerradas (alineado con el stepper). */
  const heroCtaEnabled = hasBlocking || (ctaMicroStepId != null && !isProcessComplete);
  const heroCtaIsComplete = isProcessComplete && !hasBlocking;
  const shouldPromoteServicesConfirmCta =
    activeWorkspaceStep === 4 &&
    ctaMicroStepId === 4 &&
    servicesConfirmReady;
  /** En paso 4, el CTA verde principal vive en el workspace; el hero solo desplaza al bloque de confirmación. */
  const softenHeroServicesConfirmCta = shouldPromoteServicesConfirmCta;
  const proposalDocUrl = String(documentsForUnifiedFlow?.proposal ?? "").trim();
  const presentationResolved = resolvePresentationResource(
    documentsForUnifiedFlow,
    presentationGammaUrl,
    presentationPdfUrl
  );
  const shouldPromoteProposalCreateCta =
    activeWorkspaceStep === 5 &&
    ctaMicroStepId === 5 &&
    proposalCreateReady &&
    !proposalDocUrl;
  const shouldPromotePresentationGenerateCta =
    activeWorkspaceStep === 6 &&
    ctaMicroStepId === 6 &&
    commercialState === "ready_for_presentation";
  /** En paso 6, el CTA principal vive en el workspace (evita competir con el Hero). */
  const softenHeroStep6PrimaryCta = activeWorkspaceStep === 6;
  const isPresentationReadyForClose =
    ctaMicroStepId === 6 && commercialState === "presentation_ready";
  /** En paso 6 con presentación lista, el único CTA verde fuerte es «Avanzar a cierre» en el workspace; el hero solo desplaza. */
  const softenHeroPresentationCloseCta =
    activeWorkspaceStep === 6 && isPresentationReadyForClose;
  /** Aún no está en el workspace de presentación: el hero lleva al paso 6 (un solo verde visible arriba). */
  const heroPresentationCloseNavigateOnly =
    isPresentationReadyForClose && activeWorkspaceStep !== 6;

  /** En paso 5 con propuesta pendiente de revisión, el hero no compite con el único CTA verde del workspace (confirmar 3/3). */
  const softenHeroProposalReviewCta =
    activeWorkspaceStep === 5 &&
    ctaMicroStepId === 5 &&
    commercialState === "proposal_pending_review" &&
    Boolean(proposalDocUrl);

  const needsLegacyArchive = !loadingLead && legacyGammaTransientTypes.length > 0;

  useEffect(() => {
    if (!needsLegacyArchive) setLegacyRecoverUserError(null);
  }, [needsLegacyArchive]);

  const nextActionLabel = useMemo(() => {
    if (hasBlocking && !shouldForceFlowProgress) return "Revisar información del lead (2/3)";
    if (ctaMicroStepId == null) return isProcessComplete ? "Proceso completo" : "—";
    if (ctaMicroStepId === 5 || ctaMicroStepId === 6) {
      if (commercialState === "closing") {
        return isProcessComplete ? "Proceso completo" : "Seguimiento y cierre";
      }
      if (commercialState === "proposal_pending_review") {
        return "Revisar borrador y confirmar revisión en el workspace";
      }
      return commercialStepHeroPrimaryLabel(commercialState);
    }
    return actionByStepId[ctaMicroStepId] ?? "—";
  }, [hasBlocking, shouldForceFlowProgress, ctaMicroStepId, isProcessComplete, commercialState]);

  const heroCtaLabel = hasBlocking && !shouldForceFlowProgress ? "Revisar información del lead (2/3)" : isProcessComplete ? "Proceso completo" : nextActionLabel;

  const heroPrimaryLabel = useMemo(() => {
    if (needsLegacyArchive) return "Archivar documentos (1/3)";
    if (commercialState === "closing") return "Ir a acciones de cierre";
    if (softenHeroServicesConfirmCta) return "Ir a confirmar estructura y avanzar a propuesta";
    if (shouldPromoteProposalCreateCta) return "Generar propuesta comercial";
    if (shouldPromotePresentationGenerateCta) return "Generar presentación comercial";
    if (heroPresentationCloseNavigateOnly) return "Ir a presentación comercial para cerrar la etapa";
    if (softenHeroStep6PrimaryCta) return "Ir al bloque final de cierre en presentación";
    if (softenHeroPresentationCloseCta) return "Ir al botón «Avanzar a cierre» en el workspace";
    if (softenHeroProposalReviewCta) return "Ir al bloque de revisión de propuesta";
    if (ctaMicroStepId === 5 || ctaMicroStepId === 6) {
      return commercialStepHeroPrimaryLabel(commercialState);
    }
    return heroCtaLabel;
  }, [
    softenHeroServicesConfirmCta,
    shouldPromoteProposalCreateCta,
    shouldPromotePresentationGenerateCta,
    heroPresentationCloseNavigateOnly,
    softenHeroStep6PrimaryCta,
    softenHeroPresentationCloseCta,
    softenHeroProposalReviewCta,
    needsLegacyArchive,
    ctaMicroStepId,
    commercialState,
    heroCtaLabel,
  ]);

  const heroCurrentStepLabel = isProcessComplete
    ? "Proceso completo"
    : hasBlocking && !shouldForceFlowProgress
      ? "Lead — completar datos del lead"
      : `${heroMacroFlowSnapshot.label} · ${heroMacroFlowSnapshot.progress}%`;

  /** CTA único del hero: ficha si bloqueado; si no, primer paso micro incompleto según etapa macro activa. */
  const handleHeroCta = useCallback(() => {
    if (needsLegacyArchive) {
      void handleRecoverLegacyGammaDocs();
    } else if (commercialState === "closing" && id?.trim()) {
      router.push(`/admin/leads/${encodeURIComponent(id)}?tab=acciones`);
    } else if (hasBlocking && !shouldForceFlowProgress) {
      goToFichaAndEdit();
    } else if (ctaMicroStepId === 3) {
      void moveToServicesFromHero();
    } else if (ctaMicroStepId === 5 && proposalDocUrl && commercialState === "proposal_pending_review") {
      goToWorkspace(5);
      if (activeWorkspaceStep === 5) {
        requestAnimationFrame(() => {
          document.getElementById("leads87-proposal-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } else if (ctaMicroStepId === 5 && commercialState === "ready_for_presentation") {
      goToWorkspace(6);
      void generatePresentationCommercial();
    } else if (activeWorkspaceStep === 6) {
      // En paso 6, el Hero solo guía al bloque final; no compite con CTA principal del workspace.
      requestAnimationFrame(() => {
        document.getElementById("leads87-presentation-close")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else if (isPresentationReadyForClose) {
      goToWorkspace(6);
      requestAnimationFrame(() => {
        document.getElementById("leads87-presentation-close")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else if (shouldPromoteProposalCreateCta && proposalCreateActionRef.current) {
      void proposalCreateActionRef.current();
    } else if (softenHeroServicesConfirmCta) {
      requestAnimationFrame(() => {
        document.getElementById("leads87-services-confirm")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else if (ctaMicroStepId != null) {
      handleStepAction(ctaMicroStepId);
    }
  }, [
    needsLegacyArchive,
    handleRecoverLegacyGammaDocs,
    hasBlocking,
    shouldForceFlowProgress,
    ctaMicroStepId,
    goToFichaAndEdit,
    handleStepAction,
    moveToServicesFromHero,
    softenHeroServicesConfirmCta,
    shouldPromoteProposalCreateCta,
    proposalDocUrl,
    commercialState,
    router,
    id,
    goToWorkspace,
    activeWorkspaceStep,
    generatePresentationCommercial,
    isPresentationReadyForClose,
  ]);

  const leadHasCommercialProgress = useMemo(() => {
    const l = fullLead;
    const d = documents;
    return Boolean(
      reportGeneratedLocally ||
        (l?.ai_report && String(l.ai_report).trim()) ||
        Boolean((l as { proposal_confirmed_at?: string | null } | null)?.proposal_confirmed_at) ||
        Boolean((l as { proposal_sent_at?: string | null } | null)?.proposal_sent_at) ||
        (d?.diagnostic && String(d.diagnostic).trim()) ||
        (d?.strategy && String(d.strategy).trim()) ||
        (d?.proposal && String(d.proposal).trim())
    );
  }, [fullLead, documents, reportGeneratedLocally]);

  const openDeleteLeadModal = useCallback(() => {
    setDeleteModalError(null);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDeleteLead = useCallback(async () => {
    if (!id?.trim()) return;
    setDeleteSubmitting(true);
    setDeleteModalError(null);
    try {
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = (await res.json()) as { data?: unknown; error?: string | null };
      if (!res.ok) throw new Error(json?.error ?? "No se pudo eliminar el lead.");
      try {
        sessionStorage.setItem(LEADS87_LIST_FLASH_KEY, "Lead eliminado correctamente.");
      } catch {
        /* ignore */
      }
      setDeleteConfirmOpen(false);
      router.push("/admin/leads87");
    } catch (e) {
      setDeleteModalError(e instanceof Error ? e.message : "Error al eliminar el lead.");
    } finally {
      setDeleteSubmitting(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!deleteConfirmOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !deleteSubmitting) setDeleteConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteConfirmOpen, deleteSubmitting]);

  if (!id) {
    return (
      <PageContainer>
        <p className="text-sm text-slate-600">ID de lead no válido.</p>
      </PageContainer>
    );
  }

  const leadWithExtras = fullLead as LeadForLeadsOkMacro & {
    empresa_id?: string | null;
    instagram?: string | null;
    direccion?: string | null;
    empresas?: {
      id?: string;
      nombre?: string | null;
      web?: string | null;
      instagram?: string | null;
      direccion?: string | null;
      rubros?: { nombre?: string | null } | null;
    } | null;
    comerciales?: { id?: string; nombre?: string } | null;
    comercial?: { id?: string; nombre?: string } | null;
    website?: string | null;
    linkedin_empresa?: string | null;
    linkedin_director?: string | null;
  };
  const comercialNombre = leadWithExtras?.comercial?.nombre ?? (Array.isArray(leadWithExtras?.comerciales) ? leadWithExtras?.comerciales?.[0]?.nombre : leadWithExtras?.comerciales?.nombre) ?? null;
  const rubroNombre = leadWithExtras?.empresas?.rubros?.nombre ?? null;
  const web = leadWithExtras?.website ?? leadWithExtras?.empresas?.web ?? null;
  const linkedinEmpresa = leadWithExtras?.linkedin_empresa ?? null;
  const linkedinDirector = leadWithExtras?.linkedin_director ?? null;
  const instagramDisplay = leadWithExtras?.instagram ?? leadWithExtras?.empresas?.instagram ?? null;
  const direccionDisplay = leadWithExtras?.direccion ?? leadWithExtras?.empresas?.direccion ?? null;
  const empresaOrigenId = leadWithExtras?.empresa_id ?? leadWithExtras?.empresas?.id ?? null;
  const empresaOrigenNombre = leadWithExtras?.empresas?.nombre ?? null;

  function cell(v: string | null | undefined): string {
    const t = typeof v === "string" ? v.trim() : "";
    return t || "—";
  }

  return (
    <PageContainer>
      {/* Header + Ficha del lead (contexto) */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin/leads87" className="text-sm text-slate-600 hover:text-slate-900 hover:underline">
            ← LEADS87
          </Link>
          {!loadingLead && fullLead ? (
            <button
              type="button"
              onClick={openDeleteLeadModal}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-1"
            >
              Eliminar lead
            </button>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          LEADS87 —{" "}
          {!loadingLead && fullLead ? (
            <button
              type="button"
              onClick={() => setFichaLeadOpen((o) => !o)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
              aria-expanded={fichaLeadOpen}
            >
              <span className={leadDisplayName === "—" ? "text-slate-500 font-medium" : "text-emerald-700 font-semibold hover:text-emerald-800"}>
                {leadDisplayName}
              </span>
              <span className="text-slate-400" aria-hidden>{fichaLeadOpen ? "▼" : "▶"}</span>
            </button>
          ) : (
            <span className={leadDisplayName === "—" ? "text-slate-500 font-medium" : "text-emerald-700 font-semibold"}>{loadingLead ? "Cargando…" : leadDisplayName}</span>
          )}
        </h1>
        <p className="mt-2 text-sm text-slate-600">Versión definitiva del sistema comercial. Un solo flujo, toda la información.</p>

        {!loadingLead && fullLead && fichaLeadOpen && (
          <div ref={fichaRef} className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm scroll-mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contexto del lead</span>
              {!editingFicha ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={startEditingFicha}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={openDeleteLeadModal}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                  >
                    Eliminar lead
                  </button>
                  <Link
                    href={`/admin/oportunidades/${id}`}
                    className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    Abrir en Oportunidades
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditingFicha(false); setFichaError(null); }}
                    disabled={savingFicha}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveFicha}
                    disabled={savingFicha}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingFicha ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              )}
            </div>
            {fichaError && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{fichaError}</p>
            )}
            {empresaOrigenId ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm">
                <p className="text-slate-700">
                  <span className="font-semibold text-slate-800">Entidad origen:</span>{" "}
                  {empresaOrigenNombre ? <span>{empresaOrigenNombre}</span> : <span className="text-slate-500">(sin nombre en ficha)</span>}
                </p>
                <Link
                  href={`/admin/empresas/${empresaOrigenId}`}
                  className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ver entidad
                </Link>
              </div>
            ) : null}
            {editingFicha ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <label className="block text-xs text-slate-500">Empresa</label>
                  <input
                    type="text"
                    value={editForm.nombre}
                    onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Contacto</label>
                  <input
                    type="text"
                    value={editForm.contacto}
                    onChange={(e) => setEditForm((f) => ({ ...f, contacto: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Email</label>
                  <input
                    type="text"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Teléfono</label>
                  <input
                    type="text"
                    value={editForm.telefono}
                    onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Web</label>
                  <input
                    type="text"
                    value={editForm.website}
                    onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Instagram</label>
                  <input
                    type="text"
                    value={editForm.instagram}
                    onChange={(e) => setEditForm((f) => ({ ...f, instagram: e.target.value }))}
                    placeholder="URL o @usuario"
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500">Dirección</label>
                  <input
                    type="text"
                    value={editForm.direccion}
                    onChange={(e) => setEditForm((f) => ({ ...f, direccion: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Rubro</label>
                  <div className="mt-0.5">
                    {(leadWithExtras?.empresa_id ?? (leadWithExtras?.empresas as { id?: string } | null)?.id) ? (
                      <RubroSelect
                        value={editForm.rubro_id ?? null}
                        onChange={(nextId) => setEditForm((f) => ({ ...f, rubro_id: nextId }))}
                        placeholder="Seleccionar rubro…"
                      />
                    ) : (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">Sin empresa vinculada</p>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500">LinkedIn (empresa o director)</label>
                  <div className="mt-0.5 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Empresa"
                      value={editForm.linkedin_empresa}
                      onChange={(e) => setEditForm((f) => ({ ...f, linkedin_empresa: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                    <input
                      type="text"
                      placeholder="Director"
                      value={editForm.linkedin_director}
                      onChange={(e) => setEditForm((f) => ({ ...f, linkedin_director: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Origen</label>
                  <input
                    type="text"
                    value={editForm.origen}
                    onChange={(e) => setEditForm((f) => ({ ...f, origen: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Objetivo</label>
                  <input
                    type="text"
                    value={editForm.objetivos}
                    onChange={(e) => setEditForm((f) => ({ ...f, objetivos: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Audiencia</label>
                  <input
                    type="text"
                    value={editForm.audiencia}
                    onChange={(e) => setEditForm((f) => ({ ...f, audiencia: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Tamaño</label>
                  <input
                    type="text"
                    value={editForm.tamano}
                    onChange={(e) => setEditForm((f) => ({ ...f, tamano: e.target.value }))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><p className="text-xs text-slate-500">Empresa</p><p className="font-medium text-slate-800">{cell(leadWithExtras?.empresas?.nombre ?? fullLead?.nombre)}</p></div>
                <div><p className="text-xs text-slate-500">Contacto</p><p className="font-medium text-slate-800">{cell(fullLead?.contacto)}</p></div>
                <div><p className="text-xs text-slate-500">Email</p><p className="font-medium text-slate-800">{cell(fullLead?.email)}</p></div>
                <div><p className="text-xs text-slate-500">Teléfono</p><p className="font-medium text-slate-800">{cell(fullLead?.telefono)}</p></div>
                <div><p className="text-xs text-slate-500">Rubro</p><p className="font-medium text-slate-800">{cell(rubroNombre)}</p></div>
                <div><p className="text-xs text-slate-500">Web</p><p className="font-medium text-slate-800">{cell(web)}</p></div>
                <div><p className="text-xs text-slate-500">Instagram</p><p className="font-medium text-slate-800">{cell(instagramDisplay)}</p></div>
                <div className="col-span-2"><p className="text-xs text-slate-500">Dirección</p><p className="font-medium text-slate-800">{cell(direccionDisplay)}</p></div>
                <div><p className="text-xs text-slate-500">LinkedIn empresa</p><p className="font-medium text-slate-800">{cell(linkedinEmpresa)}</p></div>
                <div><p className="text-xs text-slate-500">LinkedIn director</p><p className="font-medium text-slate-800">{cell(linkedinDirector)}</p></div>
                <div><p className="text-xs text-slate-500">Origen</p><p className="font-medium text-slate-800">{cell((fullLead as { origen?: string | null }).origen)}</p></div>
                <div><p className="text-xs text-slate-500">Objetivo</p><p className="font-medium text-slate-800">{cell((fullLead as { objetivos?: string | null }).objetivos)}</p></div>
                <div><p className="text-xs text-slate-500">Audiencia</p><p className="font-medium text-slate-800">{cell((fullLead as { audiencia?: string | null }).audiencia)}</p></div>
                <div><p className="text-xs text-slate-500">Tamaño</p><p className="font-medium text-slate-800">{cell((fullLead as { tamano?: string | null }).tamano)}</p></div>
                <div><p className="text-xs text-slate-500">Responsable</p><p className="font-medium text-slate-800">{cell(comercialNombre)}</p></div>
                <div><p className="text-xs text-slate-500">Pipeline</p><p className="font-medium text-slate-800">{cell(fullLead?.pipeline)}</p></div>
                <p className="col-span-2 mt-2 text-xs text-slate-500">Pipeline y responsable solo se editan en Oportunidades.</p>
                {empresaOrigenId ? (
                  <p className="col-span-2 mt-1 text-xs text-slate-500">
                    RUT, ciudad, país, Facebook, celular alternativo y etiquetas de la entidad siguen viviendo en la ficha de Entidad; aquí operás el snapshot comercial del lead.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {!loadingLead && (needsLegacyArchive || legacyRecoverBusy || legacyRecoverUserError) ? (
        <div
          id="leads87-archive-docs-status"
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            legacyRecoverBusy
              ? "border-blue-200 bg-blue-50/90 text-blue-950"
              : legacyRecoverUserError
                ? "border-amber-200 bg-amber-50/90 text-amber-950"
                : "border-amber-200 bg-amber-50/90 text-amber-950"
          }`}
        >
          {legacyRecoverBusy ? (
            <>
              <p className="font-semibold">Archivando documentos…</p>
              <p className="mt-1 text-xs opacity-90">Guardando copias estables en el CRM. Esto puede tardar un momento.</p>
            </>
          ) : legacyRecoverUserError ? (
            <>
              <p className="font-semibold">Archivado incompleto</p>
              <p className="mt-1 text-xs opacity-90">{legacyRecoverUserError}</p>
              <button
                type="button"
                disabled={legacyRecoverBusy}
                onClick={() => void handleRecoverLegacyGammaDocs()}
                className="mt-3 rounded-lg border-2 border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
              >
                Reintentar archivado (1/3)
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold">Hay documentos pendientes de archivar para continuar</p>
              <p className="mt-1 text-xs opacity-90">
                El paso <strong>1/3</strong> es archivar enlaces temporales en el CRM. Usá el botón verde de{" "}
                <strong>Siguiente acción</strong>: «Archivar documentos (1/3)».
              </p>
            </>
          )}
        </div>
      ) : null}

      {/* NextActionHero: foco único, CTA principal — verde = avanzar, gris = completado */}
      {!loadingLead && fullLead && (
        <div className="mt-8 rounded-2xl border-2 border-emerald-300 bg-white p-8 shadow-lg ring-4 ring-emerald-50">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">Siguiente acción</h2>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            Paso actual: {heroCurrentStepLabel}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Estado: Investigación {analisisCompleto ? "completada" : "pendiente"} · Diagnóstico {diagnosticoCompleto ? "completado" : "pendiente"}
          </p>
          {missingInCurrentStep.length > 0 && (
            <p className="mt-3 text-sm font-medium text-amber-800">
              Para avanzar al siguiente paso, completa esta información:
            </p>
          )}
          {missingInCurrentStep.length > 0 && (
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {missingInCurrentStep.slice(0, 5).map((label, i) => (
                <li key={i}>{label}</li>
              ))}
            </ul>
          )}
          {missingInCurrentStep.length === 0 && ctaMicroStepId != null && !isProcessComplete && (
            <p className="mt-2 text-sm text-slate-600">
              Siguiente paso: {nextActionLabel}
            </p>
          )}
          <div className="mt-7">
            <button
              type="button"
              disabled={
                heroCtaIsComplete ||
                heroStageUpdating ||
                (shouldPromoteProposalCreateCta && proposalCreateBusy) ||
                (shouldPromotePresentationGenerateCta && presentationGenerationBusy) ||
                (isPresentationReadyForClose && presentationCloseBusy) ||
                (ctaMicroStepId === 5 && proposalReviewPatchBusy) ||
                (needsLegacyArchive && legacyRecoverBusy)
              }
              onClick={handleHeroCta}
              className={`w-full rounded-xl px-6 py-4 text-lg font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed ${
                heroCtaIsComplete
                  ? "bg-slate-200 text-slate-500 focus:ring-slate-400"
                  : softenHeroProposalReviewCta ||
                      softenHeroPresentationCloseCta ||
                      softenHeroStep6PrimaryCta ||
                      softenHeroServicesConfirmCta
                    ? "border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus:ring-slate-400"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
              }`}
            >
              {needsLegacyArchive && legacyRecoverBusy
                ? "Archivando documentos…"
                : heroStageUpdating && ctaMicroStepId === 3
                ? "Actualizando etapa…"
                : shouldPromoteProposalCreateCta && proposalCreateBusy
                  ? "Creando propuesta…"
                : shouldPromotePresentationGenerateCta && presentationGenerationBusy
                  ? "Generando presentación a partir de la propuesta…"
                : isPresentationReadyForClose && presentationCloseBusy
                  ? "Actualizando etapa…"
                  : ctaMicroStepId === 5 && proposalReviewPatchBusy
                    ? "Guardando revisión…"
                    : heroPrimaryLabel}
            </button>
          </div>
        </div>
      )}

      {!loadingLead && fullLead && (
        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Flujo comercial</h3>
        </div>
      )}

      {/* A) Indicador de progreso del flujo (no es navegación ni botones) */}
      {!loadingLead && fullLead && (
        <div
          className="mt-4 border-b border-slate-200 pb-4"
          role="list"
          aria-label="Progreso del flujo comercial"
        >
          <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
            {PROGRESS_STAGES.map((label, i) => {
              const allStepsDone = stepperStageIndex >= PROGRESS_STAGES.length;
              const completed = allStepsDone || stepperStageIndex > i;
              const active = !allStepsDone && stepperStageIndex === i;
              return (
                <span key={i} className="inline-flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="mx-0.5 text-slate-300 select-none" aria-hidden>
                      →
                    </span>
                  )}
                  <span
                    role="listitem"
                    className="inline-flex cursor-default select-none items-center gap-1.5 rounded-md px-0 py-0.5"
                  >
                    {completed ? (
                      <>
                        <CheckCircle2
                          className="h-4 w-4 shrink-0 text-emerald-600"
                          aria-hidden
                        />
                        <span className="text-xs font-medium text-emerald-700">{label}</span>
                      </>
                    ) : active ? (
                      <>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600 ring-2 ring-emerald-200"
                          aria-hidden
                        />
                        <span className="text-xs font-semibold text-slate-900">{label}</span>
                      </>
                    ) : (
                      <>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-slate-300 bg-transparent"
                          aria-hidden
                        />
                        <span className="text-xs font-normal text-slate-400">{label}</span>
                      </>
                    )}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {loadingLead && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <p className="text-sm text-slate-600">Cargando oportunidad…</p>
        </div>
      )}

      {!loadingLead && !fullLead && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <p className="text-sm font-medium text-slate-800">
            {missingLeadContext.isEmpresaId
              ? "Este ID corresponde a una entidad, no a un lead."
              : "Lead no encontrado."}
          </p>
          {leadLoadError ? (
            <p className="mt-1 text-sm text-red-700">
              Error de carga: {leadLoadError}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            {missingLeadContext.isEmpresaId
              ? `ID recibido: ${id}. ${missingLeadContext.empresaNombre ? `Entidad: ${missingLeadContext.empresaNombre}. ` : ""}Para abrir en LEADS87 primero hay que crear/usar un lead vinculado.`
              : `ID recibido: ${id}. Puede haber sido eliminado o la URL puede apuntar a un objeto distinto.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/admin/leads87"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Volver al listado LEADS87
            </Link>
            {missingLeadContext.isEmpresaId ? (
              <Link
                href={`/admin/empresas/${encodeURIComponent(id)}`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Ir a la entidad
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {!loadingLead && fullLead && (
        <>
          {/* Progreso del proceso comercial (colapsado por defecto) */}
          {macroStages.length > 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowProgreso((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                aria-expanded={showProgreso}
              >
                <span>Progreso del proceso comercial</span>
                {showProgreso ? <ChevronDown className="h-4 w-4 shrink-0 rotate-180" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
              </button>
              {showProgreso && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  {(() => {
                    const total = 8;
                    const completedCount = macroStages.filter((s) => s.status === "completed").length;
                    const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
                    const activeStage = macroStages.find((s) => s.status === "active");
                    const allComplete = total > 0 && completedCount === total;
                    const currentLabel = allComplete ? "Proceso completo" : activeStage?.title ?? "—";
                    return (
                      <>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                              role="progressbar"
                              aria-valuenow={percentage}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label="Progreso del proceso comercial"
                            />
                          </div>
                          <span className="text-sm font-medium tabular-nums text-slate-700">{percentage}%</span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {completedCount} de {total} etapas completadas
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Etapa actual: <span className="font-medium">{currentLabel}</span>
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* B) Flujo macro del proceso (colapsado por defecto) */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowFlujoMacro((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-expanded={showFlujoMacro}
            >
              <span>Flujo macro del proceso</span>
              {showFlujoMacro ? <ChevronDown className="h-4 w-4 shrink-0 rotate-180" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {showFlujoMacro && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-500">Etapas calculadas según datos reales del lead.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {macroStages.map((stage) => (
                <div
                  key={stage.id}
                  className={`rounded-xl border-2 p-4 ${
                    stage.status === "completed"
                      ? "border-emerald-200 bg-emerald-50/60"
                      : stage.status === "active"
                        ? "border-emerald-400 bg-white ring-2 ring-emerald-100"
                        : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{stage.title}</span>
                    {stage.status === "completed" && <span className="text-xs font-medium text-emerald-700">Completado ✓</span>}
                    {stage.status === "active" && <span className="text-xs font-medium text-emerald-700">Activo</span>}
                  </div>
                  {stage.id === 2 && (
                    <>
                      <p className="mt-2 text-xs font-medium text-slate-700">Qué hacemos</p>
                      <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                        <li>Validamos el contexto y los datos previos</li>
                        <li>Ejecutamos investigación digital apoyada por prompts de IA</li>
                        <li>Generamos la base para diagnóstico y estrategia</li>
                      </ul>
                      <p className="mt-2 text-xs font-medium text-slate-700">Qué obtengo</p>
                      <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                        <li>Lectura inicial del negocio y su presencia digital</li>
                        <li>Hallazgos clave para diagnóstico comercial</li>
                        <li>Base para la visión estratégica</li>
                      </ul>
                    </>
                  )}
                  {stage.checklist.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {stage.checklist.map((item, i) => (
                        <li key={i} className={`flex items-center gap-2 text-xs ${item.done ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                            {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : null}
                          </span>
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-slate-600 italic">Resultado: {stage.result}</p>
                </div>
              ))}
              </div>
            </div>
            )}
          </div>

          {/* C) Bloques del análisis comercial (colapsado por defecto) */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowBloquesAnalisis((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-expanded={showBloquesAnalisis}
            >
              <span>Bloques de la investigación comercial</span>
              {showBloquesAnalisis ? <ChevronDown className="h-4 w-4 shrink-0 rotate-180" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {showBloquesAnalisis && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-xs text-slate-600">
              Los módulos se toman directamente desde <span className="font-semibold">Configuración IA</span>.
              Si un módulo no tiene prompt real, no se muestra en el workspace de investigación.
            </p>
          </div>
            )}
          </div>

          {/* D) Guía de pasos (colapsada por defecto); solo paso activo abierto al expandir */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowGuiaPasos((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-expanded={showGuiaPasos}
            >
              <span>Guía de pasos</span>
              {showGuiaPasos ? <ChevronDown className="h-4 w-4 shrink-0 rotate-180" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {showGuiaPasos && (
            <div className="mt-2 space-y-2">
              {microSteps.map((step) => (
                <details
                  key={step.id}
                  open={step.id === expandedStepId}
                  className={`group rounded-xl border-2 ${
                    step.status === "completed"
                      ? "border-emerald-200 bg-emerald-50/40"
                      : step.status === "active"
                        ? "border-emerald-400 bg-white ring-2 ring-emerald-100"
                        : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <summary
                    className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-slate-50/80"
                    onClick={(e) => {
                      e.preventDefault();
                      setExpandedStepId((prev) => (prev === step.id ? prev : step.id));
                    }}
                  >
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-open:rotate-90" />
                    {step.status === "completed" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
                    <span className={step.status === "completed" ? "text-slate-800" : step.status === "active" ? "font-semibold text-slate-900" : "text-slate-500"}>
                      {step.title}
                    </span>
                    {step.status === "completed" && <span className="ml-auto text-xs text-emerald-700">Completado</span>}
                    {step.status === "active" && <span className="ml-auto text-xs font-medium text-emerald-700">Activo</span>}
                  </summary>
                  <div className="border-t border-slate-100 px-4 pb-3 pt-2">
                    {step.status === "pending" && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-center">
                        <p className="text-sm font-medium text-amber-900">Primero completa el paso anterior</p>
                      </div>
                    )}
                    {step.status === "active" && step.id === 2 && (
                      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-800">
                        Paso 1 completado. Se habilitó Diagnóstico comercial.
                      </div>
                    )}
                    {step.status !== "pending" && step.id === 1 && (
                      <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        {(fullLead?.ai_report?.trim() || reportGeneratedLocally) ? (
                          <>
                            <p className="text-sm font-medium text-slate-800">Paso 1 completado. El siguiente paso es Diagnóstico comercial.</p>
                            <div className="mt-2 flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 opacity-80">
                              <span aria-hidden>🔒</span> Investigación completada
                            </div>
                            <button
                              type="button"
                              onClick={() => goToWorkspace(2)}
                              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Ir a diagnóstico comercial
                            </button>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" onClick={() => goToWorkspace(1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Ir a ver informe comercial
                              </button>
                              <button type="button" onClick={() => goToWorkspace(1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                Ir al workspace para regenerar investigación
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-slate-800">Acción recomendada</p>
                            <button type="button" onClick={() => goToWorkspace(1)} className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                              Generar investigación comercial
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {step.status !== "pending" && step.subSteps.length > 0 && (
                      <ul className="mb-2 space-y-1">
                        {step.subSteps.map((sub, i) => (
                          <li key={i} className={`flex items-center gap-2 text-xs ${sub.status === "done" ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                              {sub.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : null}
                            </span>
                            {sub.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    {step.status !== "pending" && <p className="text-xs text-slate-500"><span className="font-medium text-slate-600">Qué obtiene:</span> {step.queObtiene}</p>}
                    {step.status !== "pending" && step.id >= 2 && step.id <= 6 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => handleStepAction(step.id)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {step.id === 2 && "Revisar diagnóstico"}
                          {step.id === 3 && "Ir a visión estratégica"}
                          {step.id === 4 && "Definir propuesta de servicios"}
                          {step.id === 5 && "Ir a propuesta comercial"}
                          {step.id === 6 && "Ir a presentación final"}
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
            )}
          </div>

          <div className="mt-10 border-t border-slate-200 pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Herramientas y outputs</h3>
          </div>

          {/* E) Workspace del paso activo (siempre visible, destino del CTA) */}
          <div ref={workspaceRef} className="mt-4 scroll-mt-6">
            <h2 className="text-base font-semibold text-slate-900">Workspace del paso activo</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Paso {activeWorkspaceStep}: {activeWorkspaceStep === 1 && "Investigación del lead"}
              {activeWorkspaceStep === 2 && "Diagnóstico comercial"}
              {activeWorkspaceStep === 3 && "Estrategia de crecimiento"}
              {activeWorkspaceStep === 4 && "Estructura de servicios"}
              {activeWorkspaceStep === 5 && "Propuesta comercial"}
              {activeWorkspaceStep === 6 && (commercialState === "closing" ? "Cierre comercial (seguimiento)" : "Presentación para el cliente")}
            </p>
            {!isProcessComplete && (
              <p className="mt-1 text-xs text-slate-400">
                Etapa global (lista LEADS87 / macro):{" "}
                <span className="font-medium text-slate-600">
                  {heroMacroFlowSnapshot.label} · {heroMacroFlowSnapshot.progress}%
                </span>
                {" · "}
                Misma lógica que la tabla y el hero «Siguiente acción».
              </p>
            )}
            {diagnosticGenError && (activeWorkspaceStep === 3 || activeWorkspaceStep === 5 || activeWorkspaceStep === 6) && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {diagnosticGenError}
              </div>
            )}
            <div className="mt-4 rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm min-h-[320px]">
              {activeWorkspaceStep === 1 && id ? (
                <AiLeadReport
                  key={`leads87-s1-${id}`}
                  leadId={id}
                  lead={fullLead as any}
                  allowedProfiles={["comercial"]}
                  initialProfile="comercial"
                  useInvestigacionUiLabels
                  executionScrollRef={analysisExecutionRef}
                  onBeginAnalysisGeneration={() => {
                    analysisExecutionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  onBeforeGenerate={async () => {}}
                  onPromptSaved={refetchLead}
                  onReportGenerated={handleReportGenerated}
                  onPresentationSignalChange={(signal) => {
                    if (signal?.gammaUrl != null) setPresentationGammaUrl(signal.gammaUrl ?? null);
                    if (signal?.pdfUrl != null) setPresentationPdfUrl(signal.pdfUrl ?? null);
                  }}
                  titleLabel="Paso 1 — Investigación del lead (IA)"
                  subtitleLabel="La investigación genera la base que alimenta el diagnóstico y la visión estratégica."
                  buttonHelperText="Usá IA para investigar el lead y generar el informe interno."
                  buttonTooltipContent="Ejecutá la investigación con IA."
                  guidedStep1Mode
                  nextStepCtaLabel={nextAfterAnalysisLabel}
                  onNextStepClick={() => goToWorkspace(nextStepAfterAnalysis)}
                />
              ) : activeWorkspaceStep === 2 && id ? (
                <>
                  <Leads87DiagnosticBlock
                    executionRef={diagnosisExecutionRef}
                    investigationComplete={isInvestigationCompleted}
                    diagnosticUrl={diagnosticUrl}
                    generating={diagnosticGenLoading}
                    generationProgress={diagnosticGenProgress}
                    generationEtaSeconds={diagnosticGenEtaSeconds}
                    error={diagnosticGenError}
                    onGenerateDiagnostic={handleGenerateDiagnosticCommercial}
                    nextStepLabel={nextAfterDiagnosticLabel}
                    onNextStep={() => goToWorkspace(3)}
                    auxiliaryGammaOpenUrl={auxiliaryGammaOpenHref(archiveByType?.diagnostic)}
                    versionHistoryHint={docVersionHistoryHints.diagnostic ?? null}
                  />
                  <details className="rounded-xl border border-slate-200 bg-slate-50/50">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100/80">
                      Investigación del lead (referencia) — módulos e informe
                    </summary>
                    <div className="border-t border-slate-200 px-3 pb-4 pt-3">
                      <p className="mb-3 text-xs text-slate-600">
                        Material del Paso 1, colapsado para que el foco sea el diagnóstico comercial. Expandí solo si necesitás
                        revisar o exportar la investigación.
                      </p>
                      <AiLeadReport
                        key={`leads87-s2-ref-${id}`}
                        leadId={id}
                        lead={fullLead as any}
                        allowedProfiles={["comercial"]}
                        initialProfile="comercial"
                        useInvestigacionUiLabels
                        titleLabel="Investigación del lead (referencia)"
                        subtitleLabel="Contenido del Paso 1. El paso activo de este workspace es el diagnóstico (arriba)."
                        buttonHelperText="Regenerar o revisar la investigación si hace falta."
                        buttonTooltipContent="Ejecutá la investigación con IA."
                        guidedStep1Mode={false}
                        onBeforeGenerate={async () => {}}
                        onPromptSaved={refetchLead}
                        onReportGenerated={handleReportGenerated}
                        onPresentationSignalChange={(signal) => {
                          if (signal?.gammaUrl != null) setPresentationGammaUrl(signal.gammaUrl ?? null);
                          if (signal?.pdfUrl != null) setPresentationPdfUrl(signal.pdfUrl ?? null);
                        }}
                      />
                    </div>
                  </details>
                </>
              ) : activeWorkspaceStep === 3 && id ? (
                <>
                  {archiveByType ? (
                    <Leads87CommercialDocAccessStrip
                      label="Estrategia de crecimiento (documento en CRM)"
                      entry={archiveByType.strategy}
                      versionHint={docVersionHistoryHints.strategy ?? null}
                    />
                  ) : null}
                  <Leads87StrategyWorkspace
                    leadId={id}
                    commercialStrategyJson={(fullLead as { commercial_strategy_json?: unknown } | null)?.commercial_strategy_json}
                    strategyApprovedAt={(fullLead as { strategy_approved_at?: string | null } | null)?.strategy_approved_at}
                    investigationComplete={isInvestigationCompleted}
                    diagnosticComplete={isDiagnosticCompleted}
                    onUpdated={() => void refetchLead()}
                  />
                  <details className="mt-8 rounded-xl border border-slate-200 bg-slate-50/50">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100/80">
                      Exportación avanzada — informe IA y documento Gamma/PDF de estrategia
                    </summary>
                    <div className="border-t border-slate-200 px-3 pb-4 pt-3">
                      <p className="mb-3 text-xs text-slate-600">
                        Opcional: generar o archivar el tab de visión estratégica como PDF en el CRM. La etapa comercial se guía
                        por el bloque «Estrategia comercial» de arriba.
                      </p>
                      <AiLeadReport
                        key={`leads87-s3-${id}`}
                        leadId={id}
                        lead={fullLead as any}
                        allowedProfiles={["comercial"]}
                        initialProfile="comercial"
                        useInvestigacionUiLabels
                        gammaPersistDocumentType="strategy"
                        onBeforeGenerate={async () => {}}
                        onPromptSaved={refetchLead}
                        onReportGenerated={handleReportGenerated}
                        onPresentationSignalChange={(signal) => {
                          if (signal?.gammaUrl != null) setPresentationGammaUrl(signal.gammaUrl ?? null);
                          if (signal?.pdfUrl != null) setPresentationPdfUrl(signal.pdfUrl ?? null);
                        }}
                        titleLabel="Herramienta de informe — estrategia (referencia)"
                        subtitleLabel="No reemplaza la confirmación del bloque de estrategia comercial."
                        buttonHelperText="Revisá el informe y las exportaciones vinculadas a la estrategia."
                        buttonTooltipContent="Herramientas de IA y exportación del tab comercial."
                        guidedStep1Mode={false}
                      />
                    </div>
                  </details>
                </>
              ) : activeWorkspaceStep >= 4 && activeWorkspaceStep <= 6 ? (
                <>
                  {archiveByType && activeWorkspaceStep === 5 ? (
                    <Leads87CommercialDocAccessStrip
                      label="Propuesta comercial (documento en CRM)"
                      entry={archiveByType.proposal}
                      versionHint={docVersionHistoryHints.proposal ?? null}
                      openButtonVariant={
                        commercialState === "proposal_pending_review" ? "quiet" : "prominent"
                      }
                    />
                  ) : null}
                  {archiveByType && activeWorkspaceStep === 6 ? (
                    <Leads87CommercialDocAccessStrip
                      label="Presentación comercial (documento en CRM)"
                      entry={archiveByType.presentation}
                      versionHint={docVersionHistoryHints.presentation ?? null}
                      openButtonVariant="quiet"
                      openButtonLabel={isPdfUrl(archiveByType.presentation?.officialUrl ?? "") ? "Ver PDF" : "Abrir documento"}
                    />
                  ) : null}
                <Leads87AdvancedWorkspace
                  leadId={id}
                  leadDisplayName={leadDisplayName}
                  step={(servicesStructureConfirmed
                    ? activeWorkspaceStep
                    : activeWorkspaceStep >= 5
                      ? 4
                      : activeWorkspaceStep) as 4 | 5 | 6}
                  documents={documentsForUnifiedFlow}
                  aiReport={fullLead?.ai_report ?? null}
                  strategyApproved={strategyFlowApproved}
                  strategyContextText={strategyContextForServices}
                  proposalConfirmedAt={(fullLead as { proposal_confirmed_at?: string | null } | null)?.proposal_confirmed_at}
                  proposalSentAt={(fullLead as { proposal_sent_at?: string | null } | null)?.proposal_sent_at}
                  presentationGammaUrl={presentationGammaUrl}
                  presentationPdfUrl={presentationPdfUrl}
                  commercialState={commercialState}
                  onStructureConfirmed={refetchLead}
                  onConfirmReadinessChange={(ready) => {
                    setServicesConfirmReady(ready);
                  }}
                  onProposalDocumentCreated={() => {
                    setDiagnosticGenError(null);
                    void refetchLead();
                  }}
                  onRegisterProposalCreateAction={(action) => {
                    proposalCreateActionRef.current = action;
                  }}
                  onProposalCreateReadinessChange={(ready, busy) => {
                    setProposalCreateReady(ready);
                    setProposalCreateBusy(busy);
                  }}
                  proposalReviewed={Boolean(
                    (fullLead as { proposal_reviewed?: boolean | null } | null)?.proposal_reviewed
                  )}
                  proposalReviewPatchBusy={proposalReviewPatchBusy}
                  onMarkProposalReviewed={() => void markProposalReviewed()}
                  presentationGenerateBusy={presentationGenerationBusy}
                  presentationGenerationStatus={presentationGenerationStatus}
                  presentationGenerationProgress={presentationGenerationProgress}
                  presentationGenerationEtaSeconds={presentationGenerationEtaSeconds}
                  presentationGenerationError={presentationGenerationError}
                  presentationCloseBusy={presentationCloseBusy}
                  onGeneratePresentation={generatePresentationCommercial}
                  onOpenPresentation={presentationResolved.openUrl ? openPresentationFromHero : undefined}
                  onAdvanceToClose={moveToCloseFromPresentation}
                  onGoToClosingActions={() => {
                    if (!id?.trim()) return;
                    router.push(`/admin/leads/${encodeURIComponent(id)}?tab=acciones`);
                  }}
                />
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
                  <p className="text-sm text-slate-600">Este paso se gestiona desde el bloque superior o desde la guía de pasos.</p>
                  <p className="mt-1 text-xs text-slate-500">No se embebe aquí el layout completo del CRM.</p>
                </div>
              )}
            </div>
          </div>

          {/* Documentos del lead (persistidos en lead_documents) */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowLeadDocuments((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-expanded={showLeadDocuments}
            >
              <span>Documentos del lead</span>
              {showLeadDocuments ? <ChevronDown className="h-4 w-4 shrink-0 rotate-180" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {showLeadDocuments ? (
              <Leads87LeadDocumentsBlock
                archiveByType={archiveByType}
                documents={documentsForUnifiedFlow}
                versionSummaries={documentVersionSummaries}
                presentationGammaUrl={presentationGammaUrl}
                presentationPdfUrl={presentationPdfUrl}
                legacyTransientTypes={legacyGammaTransientTypes}
                recoverBusy={legacyRecoverBusy}
                onGoToWorkspace={goToWorkspace}
                onRecoverLegacy={handleRecoverLegacyGammaDocs}
                onOpenPresentationOfficial={openPresentationFromHero}
              />
            ) : null}
          </div>

          {/* F) Guía estratégica del proceso (colapsada por defecto) */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowGuiaEstrategica((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-expanded={showGuiaEstrategica}
            >
              <span>Guía estratégica del proceso</span>
              {showGuiaEstrategica ? <ChevronDown className="h-4 w-4 shrink-0 rotate-180" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            {showGuiaEstrategica && (
              <div className="mt-2">
                <GuiaEstrategicaProceso currentStageIndex={stepperStageIndex} />
              </div>
            )}
          </div>
        </>
      )}

      {deleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleteSubmitting) setDeleteConfirmOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leads87-delete-lead-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="leads87-delete-lead-title" className="text-lg font-semibold text-slate-900">
              Eliminar lead
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Vas a eliminar este lead. Esta acción no se puede deshacer.
            </p>
            {leadHasCommercialProgress ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Este lead ya tiene información generada en el proceso comercial.
              </p>
            ) : null}
            {deleteModalError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {deleteModalError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => !deleteSubmitting && setDeleteConfirmOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => void confirmDeleteLead()}
                className="rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
              >
                {deleteSubmitting ? "Eliminando…" : "Eliminar lead"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
