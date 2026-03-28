"use client";

import { useMemo, useState, useEffect, useRef, useCallback, type RefObject } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { pdf } from "@react-pdf/renderer";
import LeadReportPdf from "@/components/pdf/LeadReportPdf";
import { getReportProfile } from "@/lib/ai/reportProfiles";
import { buildModuleTabsFromCatalog } from "@/lib/ai/moduleCatalog";
import { parseLeadCustomPrompt, serializeLeadCustomPrompt, getModuleCustomPrompt } from "@/lib/leads/customPrompt";
import {
  mirrorGammaPdfToDocuments,
  persistGammaCompletedStatus,
  type MirrorPdfDocType,
} from "@/lib/leads/mirrorGammaPdfClient";
import { isTransientGammaExportPdfUrl } from "@/lib/leads/presentationUtils";
import { PDFDocument, StandardFonts } from "pdf-lib";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { categoryBadgeClass, type PromptBlock } from "@/lib/ai/promptBlocks";

type LeadMini = {
  id: string;
  nombre?: string | null;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  origen?: string | null;
  pipeline?: string | null;
  website?: string | null;
  objetivos?: string[] | null;
  audiencia?: string[] | null;
  tamano?: string | null;
  oferta?: string | null;
  notas?: string | null;
  ai_report?: string | null;
  ai_custom_prompt?: string | null;
};

type AiResp = {
  data?: { report: string } | null;
  error?: string | null;
};

// Configuración de tabs desde catálogo unificado de IA (misma fuente que Configuración IA)
const TABS_CONFIG = buildModuleTabsFromCatalog();

const TECH_MODULE_IDS = ["north_star_metric", "producto_servicio_estrella", "auditoria_tecnica_basica"] as const;

/** Bundle de prompts solo desde servidor (`GET /api/admin/config/ia` → tabla `config`). */
type ClientAiPromptsBundle = {
  prompts: { base?: string; modules?: Record<string, string> };
  meta: { updated_at: { base?: number; modules?: Record<string, number> } };
};

type PromptUiMeta = {
  label: string;
  category: string;
  category_color: PromptBlock["category_color"];
};

type VisibleTab = {
  id: string;
  label: string;
  tabId: string;
  categoryColor?: PromptBlock["category_color"];
};

type AnalysisProfileOption = {
  id: string;
  name: string;
};

const LEADS87_PRIMARY_PROFILE_NAME = "Agencia de Marketing / MODO EASY";

function hasNonEmptyModuleValues(modules: Record<string, string> | undefined | null): boolean {
  if (!modules || typeof modules !== "object") return false;
  return Object.values(modules).some((v) => typeof v === "string" && v.trim().length > 0);
}

function bundleFromServerSnapshot(
  api: { basePrompt: string; modulos: Record<string, string> } | null
): ClientAiPromptsBundle | null {
  if (!api?.modulos || typeof api.modulos !== "object" || Array.isArray(api.modulos)) return null;
  const modules = { ...api.modulos };
  if (!hasNonEmptyModuleValues(modules)) return null;
  const base = api.basePrompt?.trim() ? api.basePrompt : "";
  const now = Date.now();
  return {
    prompts: { base: base || undefined, modules },
    meta: { updated_at: { base: now, modules: {} } },
  };
}

async function fetchIaConfigFromApi(): Promise<{ basePrompt: string; modulos: Record<string, string>; prompts?: PromptBlock[] } | null> {
  try {
    const res = await fetch("/api/admin/config/ia", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { basePrompt?: string; modulos?: Record<string, string>; prompts?: PromptBlock[] } | null;
    };
    const data = json?.data;
    if (!data?.modulos || typeof data.modulos !== "object" || Array.isArray(data.modulos)) return null;
    if (!hasNonEmptyModuleValues(data.modulos as Record<string, string>)) return null;
    return {
      basePrompt: typeof data.basePrompt === "string" ? data.basePrompt : "",
      modulos: data.modulos as Record<string, string>,
      prompts: Array.isArray(data.prompts) ? data.prompts : undefined,
    };
  } catch {
    return null;
  }
}

const formatAiText = (text: string) => {
  if (!text) return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const formatLevels = (text: string) =>
  text.replace(/^(\d+\.\s)([^\n:]+):/gm, (_, num, title) => `**${num}${title}:**`);

const formatBullets = (text: string) => text.replace(/^- /gm, "• ");

/** Formatea segundos a "X min Y s" o "X s" para tiempo restante estimado */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Extrae las secciones de datos faltantes de un contenido
 * Filtra automáticamente cualquier referencia a "oferta" o "Qué ofrece"
 */
function extractMissingDataSections(content: string): {
  faltantes: string[];
  preguntas: string[];
  dondeCargar: string[];
} {
  const faltantes: string[] = [];
  const preguntas: string[] = [];
  const dondeCargar: string[] = [];

  if (!content || !content.trim()) {
    return { faltantes, preguntas, dondeCargar };
  }

  // Helper para filtrar referencias a oferta
  const filterOferta = (text: string): boolean => {
    const lower = text.toLowerCase();
    return !lower.includes("oferta") && !lower.includes("qué ofrece");
  };

  // Extraer sección FALTANTES
  const faltantesMatch = content.match(/###\s+FALTANTES\s*\n([\s\S]*?)(?=###|$)/i);
  if (faltantesMatch) {
    const faltantesText = faltantesMatch[1].trim();
    // Extraer líneas que empiezan con - o *
    const lines = faltantesText.split("\n").filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith("-") || trimmed.startsWith("*");
    });
    faltantes.push(...lines
      .map(line => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .filter(filterOferta));
  }

  // Extraer sección PREGUNTAS PARA COMPLETAR
  const preguntasMatch = content.match(/###\s+PREGUNTAS PARA COMPLETAR[^\n]*\s*\n([\s\S]*?)(?=###|$)/i);
  if (preguntasMatch) {
    const preguntasText = preguntasMatch[1].trim();
    // Extraer líneas numeradas o con -
    const lines = preguntasText.split("\n").filter(line => {
      const trimmed = line.trim();
      return /^\d+[).]\s/.test(trimmed) || trimmed.startsWith("-") || trimmed.startsWith("*");
    });
    preguntas.push(...lines
      .map(line => line.replace(/^\d+[).]\s*/, "").replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .filter(filterOferta));
  }

  // Extraer sección DÓNDE CARGARLO EN EL CRM
  const dondeCargarMatch = content.match(/###\s+DÓNDE CARGARLO EN EL CRM\s*\n([\s\S]*?)(?=###|$)/i);
  if (dondeCargarMatch) {
    const dondeCargarText = dondeCargarMatch[1].trim();
    // Extraer líneas que empiezan con - o *
    const lines = dondeCargarText.split("\n").filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith("-") || trimmed.startsWith("*");
    });
    dondeCargar.push(...lines
      .map(line => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .filter(filterOferta));
  }

  return { faltantes, preguntas, dondeCargar };
}

/**
 * Remueve las secciones de datos faltantes del contenido para no duplicarlas
 */
function removeMissingDataSections(content: string): string {
  if (!content || !content.trim()) return content;

  let cleaned = content;

  // Remover sección FALTANTES
  cleaned = cleaned.replace(/###\s+FALTANTES\s*\n[\s\S]*?(?=###|$)/i, "");

  // Remover sección PREGUNTAS PARA COMPLETAR
  cleaned = cleaned.replace(/###\s+PREGUNTAS PARA COMPLETAR[^\n]*\s*\n[\s\S]*?(?=###|$)/i, "");

  // Remover sección DÓNDE CARGARLO EN EL CRM
  cleaned = cleaned.replace(/###\s+DÓNDE CARGARLO EN EL CRM\s*\n[\s\S]*?(?=###|$)/i, "");

  return cleaned.trim();
}

/** Normaliza un id de tab del report a la clave canónica usada en TABS_CONFIG (evita desalineación UI vs backend). */
function canonicalTabId(rawId: string): string {
  const normalized = rawId.trim();
  if (!normalized) return rawId;
  const found = TABS_CONFIG.find((t) => t.tabId.toLowerCase() === normalized.toLowerCase());
  return found ? found.tabId : rawId;
}

/**
 * Parsea el informe completo y extrae todas las secciones por TAB
 * Formato esperado: ### TAB:<ID>
 * Retorna un objeto { [tabId]: contenido } con claves canónicas alineadas a TABS_CONFIG.
 */
function parseReportTabs(report: string): Record<string, string> {
  const tabs: Record<string, string> = {};
  
  if (!report || !report.trim()) {
    return tabs;
  }
  
  // Buscar todas las ocurrencias de ### TAB:<ID>
  const tabPattern = /###\s+TAB:\s*(\w+)\s*\n/g;
  const matches: Array<{ tabId: string; startIndex: number; endIndex: number }> = [];
  
  let match;
  while ((match = tabPattern.exec(report)) !== null) {
    const rawId = match[1];
    const startIndex = match.index + match[0].length;
    
    // Buscar el siguiente ### TAB: o el final del documento
    const remaining = report.slice(startIndex);
    const nextTabMatch = remaining.match(/###\s*TAB:\S+/);

    const nextIndex =
      nextTabMatch && typeof nextTabMatch.index === "number"
        ? nextTabMatch.index
        : null;

    const endIndex = nextIndex !== null ? startIndex + nextIndex : report.length;
    
    matches.push({ tabId: rawId, startIndex, endIndex });
  }
  
  // Si no hay matches, intentar buscar al final del documento (último tab sin salto de línea)
  if (matches.length === 0) {
    const altPattern = /###\s+TAB:\s*(\w+)\s*$/gm;
    let altMatch;
    while ((altMatch = altPattern.exec(report)) !== null) {
      const rawId = altMatch[1];
      const startIndex = altMatch.index! + altMatch[0].length;
      matches.push({ tabId: rawId, startIndex, endIndex: report.length });
    }
  }
  
  // Extraer contenido para cada tab; claves canónicas para alinear con TABS_CONFIG
  for (const { tabId: rawId, startIndex, endIndex } of matches) {
    const content = report.slice(startIndex, endIndex).trim();
    if (content) {
      const key = canonicalTabId(rawId);
      tabs[key] = content;
    }
  }
  
  return tabs;
}

export function sanitizeForPdf(input: string) {
  if (!input) return input;

  return input
    .replaceAll('\u2192', '->')   // →
    .replaceAll('\u2022', '-')    // •
    .replaceAll('\u2013', '-')    // –
    .replaceAll('\u2014', '-')    // —
    .replaceAll('\u201C', '"')    // “
    .replaceAll('\u201D', '"')    // ”
    .replaceAll('\u2018', "'")    // ‘
    .replaceAll('\u2019', "'")    // ’
    .replaceAll('\u2026', '...')  // …
    .replaceAll('\u00A0', ' ');   // nbsp
}

async function textToPdfBytes(title: string, content: string) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const width = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  const titleSize = 16;
  const bodySize = 11;
  const lineHeight = 14;

  // Sanitizar título y contenido antes de procesar
  const sanitizedTitle = sanitizeForPdf(title);
  const sanitizedContent = sanitizeForPdf(content);

  const wrap = (text: string, size: number) => {
    const words = text.replace(/\r/g, "").split(/\s+/);
    const lines: string[] = [];
    let line = "";

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const testWidth = font.widthOfTextAtSize(test, size);
      if (testWidth <= width) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);

    // preservar saltos de línea grandes por secciones
    const withBreaks: string[] = [];
    const rawLines = text.replace(/\r/g, "").split("\n");
    for (const raw of rawLines) {
      if (raw.trim() === "") {
        withBreaks.push(""); // línea en blanco
        continue;
      }
      const sub = wrap(raw, size);
      withBreaks.push(...sub);
    }

    return withBreaks.length ? withBreaks : lines;
  };

  // Title
  page.drawText(sanitizedTitle, { x: margin, y: y - titleSize, size: titleSize, font: fontBold });
  y -= 28;

  // Body
  const lines = wrap(sanitizedContent, bodySize);

  for (const ln of lines) {
    if (y < margin + 60) {
      const newPage = pdfDoc.addPage([595.28, 841.89]);
      y = newPage.getHeight() - margin;

      // pequeña marca de continuidad
      newPage.drawText(sanitizedTitle, {
        x: margin,
        y: y - 10,
        size: 10,
        font: fontBold,
      });
      y -= 24;

      // y seguimos en newPage
      (page as any) = newPage;
    }

    if (ln.trim() === "") {
      y -= lineHeight; // línea en blanco
      continue;
    }

    (page as any).drawText(sanitizeForPdf(ln), {
      x: margin,
      y: y - bodySize,
      size: bodySize,
      font,
    });
    y -= lineHeight;
  }

  return await pdfDoc.save();
}

type AiProfile = "comercial" | "tecnico";

/** Ciclo de vida del análisis en UI (LEADS87 y ficha comercial). */
export type AnalysisLifecyclePhase = "NOT_STARTED" | "PROCESSING" | "COMPLETED";

function initialPhaseFromLead(lead: LeadMini | null | undefined): AnalysisLifecyclePhase {
  const r = (lead as any)?.ai_report ?? "";
  return typeof r === "string" && r.trim() ? "COMPLETED" : "NOT_STARTED";
}

export function AiLeadReport({
  leadId,
  lead,
  onBeforeGenerate,
  onPromptSaved,
  allowedProfiles = ["comercial", "tecnico"],
  initialProfile,
  onPresentationSignalChange,
  onReportGenerated,
  titleLabel,
  subtitleLabel,
  buttonHelperText,
  buttonTooltipContent,
  guidedStep1Mode = false,
  nextStepCtaLabel,
  onNextStepClick,
  executionScrollRef,
  onBeginAnalysisGeneration,
  /** LEADS87: copy unificado “Investigación” en lugar de “Análisis” como nombre de paso (solo textos UI). */
  useInvestigacionUiLabels = false,
  /** Tipo en `lead_documents` al archivar el PDF generado en Gamma (LEADS87 paso 3 → `strategy`). */
  gammaPersistDocumentType = "presentation" as MirrorPdfDocType,
}: {
  leadId: string;
  lead?: LeadMini | null;
  onBeforeGenerate?: () => Promise<void>;
  onPromptSaved?: () => void;
  allowedProfiles?: AiProfile[];
  initialProfile?: AiProfile;
  onPresentationSignalChange?: (signals: { gammaUrl?: string | null; pdfUrl?: string | null }) => void;
  /** Se llama cuando termina la generación del informe (para que el padre pueda refetch y actualizar el flujo). */
  onReportGenerated?: () => void;
  /** Cuando se usa en el tab Comercial: título del bloque (ej. "Análisis interno del lead (IA)") */
  titleLabel?: string;
  /** Subtítulo explicativo del bloque */
  subtitleLabel?: string;
  /** Texto breve debajo del botón principal de generación */
  buttonHelperText?: string;
  /** Contenido del tooltip al pasar el mouse sobre el botón de generación comercial */
  buttonTooltipContent?: string;
  /** Modo guiado para Paso 1: menos ruido y foco en secuencia */
  guidedStep1Mode?: boolean;
  /** Texto del CTA principal al completar */
  nextStepCtaLabel?: string;
  /** Acción del CTA principal al completar */
  onNextStepClick?: () => void;
  /** Ancla de scroll al bloque de ejecución (progreso), no al panel de módulos */
  executionScrollRef?: RefObject<HTMLDivElement | null>;
  onBeginAnalysisGeneration?: () => void;
  useInvestigacionUiLabels?: boolean;
  gammaPersistDocumentType?: MirrorPdfDocType;
}) {
  const canUseCommercial = allowedProfiles.includes("comercial");
  const canUseTechnical = allowedProfiles.includes("tecnico");
  const hasAnyProfile = canUseCommercial || canUseTechnical;
  const inv = useInvestigacionUiLabels === true;
  const moduleCompleteLabel = inv ? "Investigación completada" : "Análisis completado";
  const ui = inv
    ? {
        lockedTitle: "Disponible después de generar la investigación",
        genCommercial: "Generando investigación comercial…",
        genTech: "Generando investigación técnica…",
        progressAria: "Progreso de la investigación por módulos",
        defaultSubtitle: "Generá informe técnico de oportunidades con contexto estratégico.",
        alreadyTooltip: "La investigación ya fue generada.",
        alreadyChip: "Investigación completada",
        btnCommercial: "Generar investigación comercial",
        bannerDone: "Investigación completada",
        docPrincipal: "Documento principal generado a partir de la investigación del lead.",
        modulesDetails: "Módulos de la investigación",
        modulosDestacados: "Módulos destacados de la investigación",
        modulosDestacadosH3: "Módulos destacados de la investigación",
        personalize: "Disponible como ajuste opcional de la investigación.",
        extraLabel: "Instrucciones adicionales para la investigación (opcional)",
        btnTechnical: "Generar investigación técnica",
      }
    : {
        lockedTitle: "Disponible después de generar el análisis",
        genCommercial: "Generando análisis comercial…",
        genTech: "Generando análisis técnico…",
        progressAria: "Progreso del análisis por módulos",
        defaultSubtitle: "Genera informe técnico de oportunidades con análisis estratégico.",
        alreadyTooltip: "El análisis ya fue generado.",
        alreadyChip: "Análisis ya generado",
        btnCommercial: "Generar Análisis Comercial",
        bannerDone: "Análisis completado",
        docPrincipal: "Documento principal generado a partir del análisis del lead.",
        modulesDetails: "Módulos del análisis",
        modulosDestacados: "Módulos destacados del análisis",
        modulosDestacadosH3: "Módulos destacados del análisis",
        personalize: "Disponible como ajuste opcional del análisis.",
        extraLabel: "Instrucciones adicionales para el análisis (opcional)",
        btnTechnical: "Generar Técnico",
      };

  const [aiLoading, setAiLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisCurrentModule, setAnalysisCurrentModule] = useState("");
  const [analysisTotalModules, setAnalysisTotalModules] = useState(0);
  const [report, setReport] = useState<string>("");
  /** NOT_STARTED | PROCESSING | COMPLETED — fuente de verdad UX para loader y módulos. */
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisLifecyclePhase>(() => initialPhaseFromLead(lead));
  /** Perfil de la corrida activa (textos del bloque de procesamiento). */
  const [generationProfileActive, setGenerationProfileActive] = useState<AiProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [status, setStatus] = useState<"idle" | "saving" | "generating" | "done">("idle");
  const [aiPromptExtra, setAiPromptExtra] = useState<string>("");
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSavedMessage, setPromptSavedMessage] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [reportExpanded, setReportExpanded] = useState(true);
  const [activeReportTab, setActiveReportTab] = useState<string>(TABS_CONFIG[0].id);
  const [regeneratingTab, setRegeneratingTab] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [missingAnswersText, setMissingAnswersText] = useState<string>("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [globalConfigFromApi, setGlobalConfigFromApi] = useState<{ basePrompt: string; modulos: Record<string, string>; prompts?: PromptBlock[] } | null>(null);

  const [moduleStatus, setModuleStatus] = useState<Record<string, "idle" | "running" | "done" | "error">>({});
  const [aiDoneMsg, setAiDoneMsg] = useState<string>("");
  const [reportProfile, setReportProfile] = useState<AiProfile>(() => {
    if (initialProfile && allowedProfiles.includes(initialProfile)) return initialProfile;
    if (canUseCommercial) return "comercial";
    if (canUseTechnical) return "tecnico";
    return "comercial";
  });
  const [analysisProfiles, setAnalysisProfiles] = useState<AnalysisProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [gammaPromptOpen, setGammaPromptOpen] = useState(false);
  const [gammaPromptText, setGammaPromptText] = useState("");
  const [gammaPromptLoading, setGammaPromptLoading] = useState(false);
  const [gammaPromptError, setGammaPromptError] = useState<string | null>(null);
  const [gammaLoading, setGammaLoading] = useState(false);
  const [gammaProgress, setGammaProgress] = useState(0);
  const [gammaStartTime, setGammaStartTime] = useState<number | null>(null);
  const [gammaEstimatedRemaining, setGammaEstimatedRemaining] = useState<number | null>(null);
  const [pdfExporting, setPdfExporting] = useState<"comercial" | "tecnico" | "vision" | null>(null);
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);
  const [gammaPdfUrl, setGammaPdfUrl] = useState<string | null>(null);
  const [gammaStablePdfUrl, setGammaStablePdfUrl] = useState<string | null>(null);
  const [gammaMirrorBusy, setGammaMirrorBusy] = useState(false);
  const [gammaMirrorError, setGammaMirrorError] = useState<string | null>(null);
  const [gammaError, setGammaError] = useState<string | null>(null);
  const [gammaGenerationId, setGammaGenerationId] = useState<string | null>(null);
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const moduleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabsBarRef = useRef<HTMLDivElement | null>(null);
  const modulePanelRef = useRef<HTMLDivElement | null>(null);

  const VISION_TAB_ID = "vision_estrategica";
  const isProcessingPhase = analysisPhase === "PROCESSING";
  const analysisPercent = Math.min(100, Math.max(0, analysisProgress));
  const analysisEstimatedRemaining = useMemo(() => {
    if (!isProcessingPhase || !analysisStartedAt || analysisPercent <= 5 || analysisPercent >= 100)
      return null;
    const elapsed = (Date.now() - analysisStartedAt) / 1000;
    const totalEstimated = elapsed / (analysisPercent / 100);
    return Math.max(1, Math.round(totalEstimated - elapsed));
  }, [isProcessingPhase, analysisStartedAt, analysisPercent]);

  useEffect(() => {
    let cancelled = false;
    async function loadAnalysisProfiles() {
      try {
        setLoadingProfiles(true);
        const res = await fetch("/api/ai/profiles", { cache: "no-store" });
        const json = (await res.json().catch(() => ([]))) as AnalysisProfileOption[] | { data?: AnalysisProfileOption[] };
        if (!res.ok || cancelled) return;
        const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
        const saved = typeof window !== "undefined" ? window.localStorage.getItem("ia_profile_id") : null;
        const leads87Primary = useInvestigacionUiLabels
          ? rows.find((r) => r.name === LEADS87_PRIMARY_PROFILE_NAME)?.id ?? ""
          : "";
        const preferred = saved && rows.some((r) => r.id === saved) ? saved : "";
        setAnalysisProfiles(rows);
        setSelectedProfileId((prev) => prev || leads87Primary || preferred || rows[0]?.id || "");
      } catch {
        if (!cancelled) {
          setAnalysisProfiles([]);
          setSelectedProfileId("");
        }
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    }
    void loadAnalysisProfiles();
    return () => {
      cancelled = true;
    };
  }, [useInvestigacionUiLabels]);

  useEffect(() => {
    if (!selectedProfileId || typeof window === "undefined") return;
    window.localStorage.setItem("ia_profile_id", selectedProfileId);
  }, [selectedProfileId]);

  useEffect(() => {
    if (!onPresentationSignalChange) return;
    const transientPdf = gammaPdfUrl?.trim() || null;
    const pdfForParent =
      gammaStablePdfUrl?.trim() ||
      (transientPdf && !isTransientGammaExportPdfUrl(transientPdf) ? transientPdf : null);
    if (gammaUrl?.trim() || transientPdf) {
      onPresentationSignalChange({
        gammaUrl: gammaUrl ?? null,
        pdfUrl: pdfForParent,
      });
    }
  }, [gammaUrl, gammaPdfUrl, gammaStablePdfUrl, onPresentationSignalChange]);

  useEffect(() => {
    if (!leadId?.trim()) {
      setGammaStablePdfUrl(null);
      setGammaMirrorError(null);
      setGammaMirrorBusy(false);
      return;
    }
    if (!gammaPdfUrl?.trim()) {
      setGammaMirrorError(null);
      setGammaMirrorBusy(false);
      return;
    }
    if (!isTransientGammaExportPdfUrl(gammaPdfUrl)) {
      setGammaStablePdfUrl(gammaPdfUrl.trim());
      setGammaMirrorError(null);
      setGammaMirrorBusy(false);
      return;
    }
    let cancelled = false;
    setGammaMirrorBusy(true);
    setGammaMirrorError(null);
    setGammaStablePdfUrl(null);
    void (async () => {
      try {
        const stable = await mirrorGammaPdfToDocuments(
          leadId.trim(),
          gammaPdfUrl.trim(),
          gammaPersistDocumentType,
          gammaGenerationId,
          { persist: true }
        );
        if (!cancelled) {
          setGammaStablePdfUrl(stable);
          setGammaMirrorError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setGammaMirrorError(e instanceof Error ? e.message : "No se pudo archivar el PDF.");
        }
      } finally {
        if (!cancelled) setGammaMirrorBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, gammaPdfUrl, gammaGenerationId, gammaPersistDocumentType]);

  // Ocultar barra de progreso unos segundos después de "Análisis completado"
  useEffect(() => {
    if (
      !aiLoading &&
      analysisProgress === 100 &&
      analysisCurrentModule === moduleCompleteLabel
    ) {
      const t = setTimeout(() => {
        setAnalysisProgress(0);
        setAnalysisCurrentModule("");
        setAnalysisTotalModules(0);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [aiLoading, analysisProgress, analysisCurrentModule, moduleCompleteLabel]);

  useEffect(() => {
    if (!guidedStep1Mode) return;
    setReportExpanded(false);
  }, [guidedStep1Mode]);

  const fetchGammaPrompt = async (type: "comercial" | "tecnico") => {
    if (!leadId?.trim()) return;
    setGammaPromptLoading(true);
    setGammaPromptError(null);
    setGammaPromptText("");
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/gamma-prompt?type=${type}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error ?? "Error generando prompt");
      const prompt = (json as any)?.data?.prompt ?? "";
      setGammaPromptText(prompt);
      setGammaPromptOpen(true);
    } catch (e: any) {
      setGammaPromptError(e?.message ?? "Error generando prompt Gamma");
    } finally {
      setGammaPromptLoading(false);
    }
  };

  const copyGammaPrompt = async () => {
    if (!gammaPromptText) return;
    await navigator.clipboard.writeText(gammaPromptText);
    setToastMessage("Prompt copiado al portapapeles");
    setTimeout(() => setToastMessage(null), 2500);
  };

  const pollGammaStatus = async (generationId: string, startTime: number) => {
    setGammaProgress(0);
    const totalPolls = 45;
    for (let i = 0; i < totalPolls; i++) {
      const res = await fetch(
        `/api/admin/leads/${leadId}/gamma-proposal/status?generationId=${encodeURIComponent(generationId)}`
      );
      const json = await res.json().catch(() => ({}));

      if (json?.status === "completed") {
        if (process.env.NODE_ENV !== "production") {
          console.log("[GAMMA frontend completed payload]", JSON.stringify(json, null, 2));
        }
        const pdfUrl = json?.pdfUrl ?? null;
        const gammaUrlVal = json?.gammaUrl ?? null;
        setGammaUrl(gammaUrlVal);
        setGammaPdfUrl(pdfUrl);

        const persisted = await persistGammaCompletedStatus(
          leadId.trim(),
          gammaPersistDocumentType,
          generationId,
          { pdfUrl, gammaUrl: gammaUrlVal }
        );

        if (persisted.crmArchivedUrl) {
          setGammaPdfUrl(null);
          setGammaStablePdfUrl(persisted.crmArchivedUrl);
          setGammaMirrorError(null);
          setGammaMirrorBusy(false);
          setGammaError(null);
        } else if (persisted.error) {
          setGammaError(persisted.error);
        } else if (persisted.pendingMessage) {
          setGammaError(persisted.pendingMessage);
        } else {
          setGammaError(null);
        }

        setGammaProgress(100);
        setGammaEstimatedRemaining(null);
        setGammaStartTime(null);
        setGammaLoading(false);
        void onReportGenerated?.();
        return;
      }

      if (json?.status === "failed") {
        setGammaLoading(false);
        setGammaProgress(0);
        setGammaEstimatedRemaining(null);
        setGammaStartTime(null);
        setGammaError("Gamma no pudo completar la propuesta.");
        return;
      }

      const progress = Math.min(95, Math.round(((i + 1) / totalPolls) * 100));
      setGammaProgress(progress);
      if (progress > 15) {
        const elapsed = (Date.now() - startTime) / 1000;
        const totalEstimated = elapsed / (progress / 100);
        const remaining = Math.max(0, totalEstimated - elapsed);
        setGammaEstimatedRemaining(Math.round(remaining));
      }
      await new Promise((r) => setTimeout(r, 4000));
    }

    setGammaLoading(false);
    setGammaProgress(0);
    setGammaEstimatedRemaining(null);
    setGammaStartTime(null);
    setGammaError("Gamma sigue procesando. Puedes reintentar abrir el estado en unos minutos.");
  };

  const generateGammaProposal = async (profile: "comercial" | "tecnico") => {
    if (!leadId?.trim()) return;
    const startTime = Date.now();
    setGammaStartTime(startTime);
    setGammaEstimatedRemaining(null);
    setGammaLoading(true);
    setGammaProgress(0);
    setGammaError(null);
    setGammaUrl(null);
    setGammaPdfUrl(null);
    setGammaStablePdfUrl(null);
    setGammaMirrorError(null);
    setGammaMirrorBusy(false);
    setGammaGenerationId(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/gamma-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error ?? "Error generando Gamma");
      const generationId = (json as any)?.generationId ?? null;
      if (!generationId) throw new Error("No se recibió generationId");
      setGammaGenerationId(generationId);
      await pollGammaStatus(generationId, startTime);
    } catch (e: any) {
      setGammaError(e?.message ?? "Error generando propuesta en Gamma");
      setGammaEstimatedRemaining(null);
      setGammaStartTime(null);
      setGammaLoading(false);
    }
  };

  const retryGammaMirror = useCallback(async () => {
    if (!leadId?.trim() || !gammaPdfUrl?.trim() || !isTransientGammaExportPdfUrl(gammaPdfUrl)) return;
    setGammaMirrorBusy(true);
    setGammaMirrorError(null);
    try {
      const stable = await mirrorGammaPdfToDocuments(
        leadId.trim(),
        gammaPdfUrl.trim(),
        gammaPersistDocumentType,
        gammaGenerationId,
        { persist: true }
      );
      setGammaStablePdfUrl(stable);
    } catch (e: unknown) {
      setGammaMirrorError(e instanceof Error ? e.message : "No se pudo archivar el PDF.");
    } finally {
      setGammaMirrorBusy(false);
    }
  }, [leadId, gammaPdfUrl, gammaGenerationId, gammaPersistDocumentType]);

  const visibleTabs = useMemo<VisibleTab[]>(() => {
    const profileModuleIds = getReportProfile(reportProfile).moduleIds;
    const configuredModules = globalConfigFromApi?.modulos;
    const promptMetaByModule = new Map<string, PromptUiMeta>();
    (globalConfigFromApi?.prompts ?? []).forEach((p) => {
      const moduleId = String(p?.module_id ?? "").trim();
      if (!moduleId) return;
      promptMetaByModule.set(moduleId, {
        label: (p?.label || "").trim() || moduleId,
        category: (p?.category || "").trim() || "General",
        category_color: p?.category_color || "slate",
      });
    });
    const configuredByLower = configuredModules
      ? (() => {
          const map = new Map<string, string>();
          Object.entries(configuredModules).forEach(([k, v]) => {
            const key = String(k ?? "").toLowerCase();
            const value = typeof v === "string" ? v.trim() : "";
            if (key && value) map.set(key, value);
          });
          return map;
        })()
      : null;

    return TABS_CONFIG.filter((tab) => {
      if (!profileModuleIds.includes(tab.tabId)) return false;
      if (!configuredByLower) return true;
      return configuredByLower.has(tab.tabId.toLowerCase());
    }).map((tab) => {
      const meta = promptMetaByModule.get(tab.tabId);
      return {
        ...tab,
        label: meta ? `${meta.category} / ${meta.label}` : tab.label,
        categoryColor: meta?.category_color ?? "slate",
      };
    });
  }, [reportProfile, globalConfigFromApi]);

  // Cargar prompt global real desde API (misma fuente que el backend)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/config/ia", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const data = (json as { data?: { basePrompt?: string; modulos?: Record<string, string>; prompts?: PromptBlock[] } | null })?.data;
        if (data) {
          const next = {
            basePrompt: typeof data.basePrompt === "string" ? data.basePrompt : "",
            modulos: data.modulos && typeof data.modulos === "object" && !Array.isArray(data.modulos) ? data.modulos : {},
            prompts: Array.isArray(data.prompts) ? data.prompts : undefined,
          };
          setGlobalConfigFromApi(next);
          if (process.env.NODE_ENV !== "production") {
            console.log("[PROMPT DEBUG] globalConfigFromApi", {
              basePromptLength: next.basePrompt?.length ?? 0,
              modulosKeys: Object.keys(next.modulos),
              modulosSample: Object.fromEntries(Object.entries(next.modulos).slice(0, 3).map(([k, v]) => [k, (v ?? "").slice(0, 60) + "…"])),
            });
          }
        }
      } catch {
        if (!cancelled) setGlobalConfigFromApi(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Resuelve el prompt global efectivo del módulo activo: base + prompt del módulo.
   * Devuelve { resolvedModuleKey, basePrompt, modulePrompt, combinedPrompt }.
   */
  const getResolvedGlobalPromptForActiveModule = useCallback(
    (
      config: { basePrompt?: string; modulos?: Record<string, string> } | null,
      activeTab: string,
      tabs: ReadonlyArray<{ id: string; label: string; tabId: string }>
    ): { resolvedModuleKey: string | null; basePrompt: string; modulePrompt: string; combinedPrompt: string } => {
      const empty = { resolvedModuleKey: null, basePrompt: "", modulePrompt: "", combinedPrompt: "" };
      if (!config) return empty;
      const basePrompt = (typeof config.basePrompt === "string" ? config.basePrompt : "").trim();
      const modulos = config.modulos && typeof config.modulos === "object" ? config.modulos : {};
      const activeTabConfig = tabs.find((t) => t.id === activeTab) ?? TABS_CONFIG.find((t) => t.id === activeTab);
      if (!activeTabConfig) {
        const combinedPrompt = basePrompt || "";
        if (process.env.NODE_ENV !== "production") {
          console.log("[PROMPT DEBUG] activeReportTab", activeTab);
          console.log("[PROMPT DEBUG] activeTabConfig", null);
          console.log("[PROMPT DEBUG] resolvedModuleKey", "(no tab config)");
          console.log("[PROMPT DEBUG] basePrompt preview", basePrompt?.slice(0, 120) || "(vacío)");
          console.log("[PROMPT DEBUG] modulePrompt preview", "(vacío)");
          console.log("[PROMPT DEBUG] combinedPrompt preview", combinedPrompt?.slice(0, 200) || "(vacío)");
        }
        return { resolvedModuleKey: null, basePrompt, modulePrompt: "", combinedPrompt };
      }
      const tabId = activeTabConfig.tabId;
      let modulePrompt = (modulos[tabId] ?? "").trim();
      let resolvedModuleKey: string | null = modulePrompt ? tabId : null;
      if (!modulePrompt && tabId) {
        const keyMatch = Object.keys(modulos).find((k) => k.toLowerCase() === tabId.toLowerCase());
        if (keyMatch) {
          modulePrompt = (modulos[keyMatch] ?? "").trim();
          resolvedModuleKey = keyMatch;
        }
      }
      const parts = [basePrompt, modulePrompt].map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
      const combinedPrompt = parts.join("\n\n");
      if (process.env.NODE_ENV !== "production") {
        console.log("[PROMPT DEBUG] activeReportTab", activeTab);
        console.log("[PROMPT DEBUG] activeTabConfig", activeTabConfig);
        console.log("[PROMPT DEBUG] resolvedModuleKey", resolvedModuleKey);
        console.log("[PROMPT DEBUG] basePrompt preview", basePrompt?.slice(0, 120) || "(vacío)");
        console.log("[PROMPT DEBUG] modulePrompt preview", modulePrompt?.slice(0, 120) || "(vacío)");
        console.log("[PROMPT DEBUG] combinedPrompt preview", combinedPrompt?.slice(0, 200) || "(vacío)");
      }
      return { resolvedModuleKey, basePrompt, modulePrompt, combinedPrompt };
    },
    []
  );

  // Prompt global del módulo activo solamente (sin base). El base se edita en Configuración global.
  const globalModulePrompt = useMemo(() => {
    const resolved = getResolvedGlobalPromptForActiveModule(globalConfigFromApi, activeReportTab, visibleTabs);
    return resolved.modulePrompt;
  }, [globalConfigFromApi, activeReportTab, visibleTabs, getResolvedGlobalPromptForActiveModule]);

  // Módulo activo: tabId para custom prompt por módulo (alineado con TABS_CONFIG)
  const resolvedModuleKey = useMemo(() => {
    const tab = visibleTabs.find((t) => t.id === activeReportTab) ?? TABS_CONFIG.find((t) => t.id === activeReportTab);
    return tab?.tabId ?? null;
  }, [activeReportTab, visibleTabs]);

  // Parsear ai_custom_prompt: por módulo (byModule) o legacy (string plano)
  const parsedCustomPrompt = useMemo(
    () => parseLeadCustomPrompt(lead?.ai_custom_prompt),
    [lead?.ai_custom_prompt]
  );

  // Custom del lead para el módulo activo (case-insensitive)
  const moduleCustomPrompt = useMemo(
    () => (resolvedModuleKey ? getModuleCustomPrompt(parsedCustomPrompt, resolvedModuleKey) : null),
    [parsedCustomPrompt, resolvedModuleKey]
  );

  // Prioridad: A) custom del lead para este módulo, B) prompt global del módulo, C) legacy (compatibilidad)
  const visiblePrompt = useMemo(() => {
    const fromModule = moduleCustomPrompt?.trim();
    if (fromModule) return fromModule;
    if (globalModulePrompt?.trim()) return globalModulePrompt;
    return parsedCustomPrompt.legacyText?.trim() ?? globalModulePrompt ?? "";
  }, [moduleCustomPrompt, globalModulePrompt, parsedCustomPrompt.legacyText]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[CUSTOM PROMPT DEBUG] resolvedModuleKey", resolvedModuleKey);
      console.log("[CUSTOM PROMPT DEBUG] raw ai_custom_prompt", lead?.ai_custom_prompt);
      console.log("[CUSTOM PROMPT DEBUG] parsed custom prompt", parsedCustomPrompt);
      console.log("[CUSTOM PROMPT DEBUG] module custom prompt", moduleCustomPrompt);
      console.log("[CUSTOM PROMPT DEBUG] visiblePrompt", visiblePrompt?.slice(0, 150) ?? "(vacío)");
      console.log("[PROMPT EDIT DEBUG] isEditingPrompt", isEditingPrompt);
      console.log("[PROMPT EDIT DEBUG] visiblePrompt", visiblePrompt?.slice(0, 80) ?? "(vacío)");
      console.log("[PROMPT EDIT DEBUG] draftPrompt", aiPromptExtra?.slice(0, 80) ?? "(vacío)");
    }
  }, [resolvedModuleKey, lead?.ai_custom_prompt, parsedCustomPrompt, moduleCustomPrompt, visiblePrompt, isEditingPrompt, aiPromptExtra]);

  useEffect(() => {
    const isActiveInVisible = visibleTabs.some((t) => t.id === activeReportTab);
    if (!isActiveInVisible && visibleTabs.length > 0) {
      setActiveReportTab(visibleTabs[0].id);
    }
  }, [reportProfile, visibleTabs]);

  const canRun = !!(leadId && leadId.trim());

  /** Al iniciar generación, llevar la vista al bloque de progreso (no a los módulos). */
  useEffect(() => {
    if (!isProcessingPhase) return;
    const t = requestAnimationFrame(() => {
      executionScrollRef?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(t);
  }, [isProcessingPhase, executionScrollRef]);

  /** Sincronizar COMPLETED desde el lead salvo durante PROCESSING. */
  useEffect(() => {
    setAnalysisPhase((prev) => {
      if (prev === "PROCESSING") return prev;
      return initialPhaseFromLead(lead);
    });
  }, [leadId, (lead as any)?.ai_report]);

  // Inicializar report desde el lead cuando se carga o cambia
  useEffect(() => {
    const initialReport = (lead as any)?.ai_report ?? "";
    if (initialReport && initialReport.trim()) {
      setReport(initialReport);
      setReportExpanded(true); // Auto-expandir cuando hay informe
      setAnalysisPhase((p) => (p === "PROCESSING" ? p : "COMPLETED"));
    }
  }, [lead]);

  // Sincronizar valor mostrado con el prompt resuelto solo cuando NO estamos editando
  useEffect(() => {
    if (!isEditingPrompt) setAiPromptExtra(visiblePrompt);
  }, [visiblePrompt, isEditingPrompt]);

  // Al cambiar de módulo/tab, salir de edición y mostrar el prompt del nuevo módulo
  useEffect(() => {
    setIsEditingPrompt(false);
    setAiPromptExtra(visiblePrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar tab; visiblePrompt ya es del tab actual
  }, [activeReportTab]);

  const savePromptToLead = async () => {
    if (!leadId?.trim()) return;
    const moduleKey = visibleTabs.find((t) => t.id === activeReportTab)?.tabId ?? TABS_CONFIG.find((t) => t.id === activeReportTab)?.tabId;
    if (!moduleKey) {
      setPromptError("No se pudo identificar el módulo activo.");
      return;
    }
    setPromptError(null);
    setPromptSavedMessage(null);
    setSavingPrompt(true);
    try {
      const parsed = parseLeadCustomPrompt(lead?.ai_custom_prompt);
      const newByModule = { ...parsed.byModule };
      newByModule[moduleKey] = aiPromptExtra.trim();
      const payload = serializeLeadCustomPrompt(newByModule);
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId.trim())}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_custom_prompt: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPromptError((json as { error?: string })?.error ?? "Error guardando el prompt del lead.");
        return;
      }
      setPromptSavedMessage("Prompt de este módulo guardado.");
      setTimeout(() => setPromptSavedMessage(null), 4000);
      setIsEditingPrompt(false);
      onPromptSaved?.();
    } catch (e: any) {
      setPromptError(e?.message ?? "Error guardando el prompt del lead.");
    } finally {
      setSavingPrompt(false);
    }
  };

  const cancelPromptEdit = () => {
    setAiPromptExtra(visiblePrompt);
    setIsEditingPrompt(false);
    setPromptError(null);
  };

  const restoreGlobalPrompt = async () => {
    if (!leadId?.trim()) return;
    const moduleKey = visibleTabs.find((t) => t.id === activeReportTab)?.tabId ?? TABS_CONFIG.find((t) => t.id === activeReportTab)?.tabId;
    if (!moduleKey) {
      setPromptError("No se pudo identificar el módulo activo.");
      return;
    }
    setPromptError(null);
    setPromptSavedMessage(null);
    setSavingPrompt(true);
    try {
      const parsed = parseLeadCustomPrompt(lead?.ai_custom_prompt);
      const newByModule = { ...parsed.byModule };
      delete newByModule[moduleKey];
      const payload = serializeLeadCustomPrompt(newByModule);
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId.trim())}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_custom_prompt: payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPromptError((json as { error?: string })?.error ?? "Error restaurando prompt global.");
        return;
      }
      setPromptSavedMessage("Este módulo vuelve a usar el prompt global.");
      setTimeout(() => setPromptSavedMessage(null), 4000);
      const resolved = getResolvedGlobalPromptForActiveModule(globalConfigFromApi, activeReportTab, visibleTabs);
      setAiPromptExtra(resolved.modulePrompt);
      setIsEditingPrompt(false);
      onPromptSaved?.();
    } catch (e: any) {
      setPromptError(e?.message ?? "Error restaurando prompt global.");
    } finally {
      setSavingPrompt(false);
    }
  };

  const filename = useMemo(() => {
    const base = (lead?.nombre || "lead").toString().trim().replace(/[^\w\-]+/g, "_");
    const stamp = new Date().toISOString().slice(0, 10);
    return `AI_Informe_${base}_${stamp}.pdf`;
  }, [lead?.nombre]);

  // Derivar tabs desde el texto completo del informe
  const reportTabs = useMemo(() => {
    return parseReportTabs(report);
  }, [report]);

  // Derivar datos faltantes por tab (ya filtrado para excluir oferta)
  const missingDataByTab = useMemo(() => {
    const result: Record<string, { faltantes: string[]; preguntas: string[]; dondeCargar: string[] }> = {};
    Object.entries(reportTabs).forEach(([tabId, content]) => {
      result[tabId] = extractMissingDataSections(content);
    });
    return result;
  }, [reportTabs]);

  // Función para copiar preguntas al portapapeles
  const copyQuestions = async (preguntas: string[]) => {
    if (preguntas.length === 0) return;
    const text = preguntas.map((p, idx) => `${idx + 1}) ${p}`).join("\n");
    await navigator.clipboard.writeText(text);
    setToastMessage("Preguntas copiadas al portapapeles ✅");
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Función para agregar respuestas a faltantes a Personalización IA con subsecciones por módulo
  const addMissingAnswersToPersonalization = (moduleId: string, moduleLabel: string) => {
    if (!missingAnswersText.trim()) {
      setToastMessage("No hay respuestas para agregar");
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }

    // Formatear respuestas como lista con viñetas
    const answersLines = missingAnswersText.trim().split("\n").filter(line => line.trim());
    const formattedAnswers = answersLines.map(line => {
      const trimmed = line.trim();
      // Si ya empieza con -, dejarlo así; sino agregar -
      return trimmed.startsWith("-") ? trimmed : `- ${trimmed}`;
    }).join("\n");

    // Crear subsección del módulo
    const moduleSubsection = `#### ${moduleLabel}\n${formattedAnswers}`;
    
    let updatedPrompt = aiPromptExtra;
    const sectionHeader = "### RESPUESTAS A FALTANTES";
    
    // Verificar si ya existe la sección "RESPUESTAS A FALTANTES"
    const hasExistingSection = updatedPrompt.includes(sectionHeader);
    
    if (hasExistingSection) {
      // Buscar la sección completa
      const sectionPattern = /###\s+RESPUESTAS A FALTANTES([\s\S]*?)(?=###|$)/i;
      const match = updatedPrompt.match(sectionPattern);
      
      if (match) {
        const existingContent = match[1] || "";
        const moduleSubsectionPattern = new RegExp(`####\\s+${moduleLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=####|$)`, "i");
        
        if (moduleSubsectionPattern.test(existingContent)) {
          // Reemplazar solo la subsección del módulo
          const updatedContent = existingContent.replace(moduleSubsectionPattern, moduleSubsection);
          updatedPrompt = updatedPrompt.replace(sectionPattern, `${sectionHeader}${updatedContent}`);
        } else {
          // Agregar la subsección al final de la sección existente
          const updatedContent = existingContent.trim() 
            ? `${existingContent}\n\n${moduleSubsection}`
            : `\n${moduleSubsection}`;
          updatedPrompt = updatedPrompt.replace(sectionPattern, `${sectionHeader}${updatedContent}`);
        }
      }
    } else {
      // Crear nueva sección con la subsección del módulo
      const newSection = `${sectionHeader}\n${moduleSubsection}`;
      if (updatedPrompt.trim()) {
        updatedPrompt = `${updatedPrompt}\n\n${newSection}`;
      } else {
        updatedPrompt = newSection;
      }
    }
    
    setAiPromptExtra(updatedPrompt);
    setMissingAnswersText("");
    setToastMessage("Respuestas agregadas a Personalización IA ✅");
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Lookup case-insensitive del prompt del módulo (evita envío de prompt vacío si la config usa otra clave)
  const getModulePromptForTab = useCallback((tabId: string, modules: Record<string, string> | undefined): string => {
    if (!modules || !tabId) return "";
    const key = Object.keys(modules).find(
      (k) => k.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_") === tabId.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_")
    );
    return key ? (modules[key] || "") : (modules[tabId] || "");
  }, []);

  /** Solo configuración persistida en servidor (cache en estado + refetch). */
  const resolveIaPromptsForExecution = useCallback(async (): Promise<ClientAiPromptsBundle | null> => {
    let bundle = bundleFromServerSnapshot(globalConfigFromApi);
    if (bundle) return bundle;
    const snap = await fetchIaConfigFromApi();
    if (snap) {
      setGlobalConfigFromApi(snap);
      bundle = bundleFromServerSnapshot(snap);
    }
    return bundle ?? null;
  }, [globalConfigFromApi]);

  // Regenera un solo módulo; retorna { ok, report, error } para uso en loop o manual
  const regenerateSingleModule = async (
    tabId: string,
    moduleCustomPromptOverride?: string | null
  ): Promise<{ ok: boolean; report?: string; error?: string }> => {
    if (!leadId?.trim()) return { ok: false, error: "Sin leadId" };

    const promptsData = await resolveIaPromptsForExecution();
    if (!promptsData || !hasNonEmptyModuleValues(promptsData.prompts.modules)) {
      return {
        ok: false,
        error:
          "No hay prompts de módulos en el servidor. Guardá la configuración en Admin → Configuración → IA y reintentá.",
      };
    }

    const customPromptValue = typeof moduleCustomPromptOverride === "string"
      ? (moduleCustomPromptOverride.trim() || null)
      : null;
    const onlyModule = (tabId ?? "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
    const modulePrompt = getModulePromptForTab(tabId, promptsData.prompts.modules);
    const body = {
      custom_prompt: customPromptValue || undefined,
      personalization: customPromptValue || undefined,
      force_regenerate: true,
      only_module: onlyModule,
      profile: reportProfile,
      profile_id: selectedProfileId || undefined,
      prompts: {
        base: promptsData.prompts.base || "",
        modules: { [tabId]: modulePrompt },
      },
      prompts_meta: promptsData.meta,
    };

    if (process.env.NODE_ENV !== "production") {
      const activeTabConfig = visibleTabs.find((t) => t.tabId === tabId) ?? TABS_CONFIG.find((t) => t.tabId === tabId);
      console.log("[MODULE REGEN DEBUG] activeReportTab", activeReportTab);
      console.log("[MODULE REGEN DEBUG] activeTabConfig", activeTabConfig);
      console.log("[MODULE REGEN DEBUG] tabId", activeTabConfig?.tabId ?? tabId);
      console.log("[MODULE REGEN DEBUG] prompt being sent", (aiPromptExtra ?? modulePrompt ?? "").slice(0, 200));
      console.log("[MODULE REGEN DEBUG] profile", reportProfile);
    }

    try {
      const res = await fetch(`/api/admin/leads/${leadId}/ai-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: text || "Error regenerando módulo" };
      }
      const data = await res.json();
      if (process.env.NODE_ENV !== "production") {
        const json = data;
        console.log("[MODULE REGEN DEBUG] response", json);
      }
      const updatedReport = data.data?.report ?? data.report ?? "";
      return { ok: true, report: updatedReport };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Error regenerando módulo" };
    }
  };

  const regenerateTab = async (tabId: string) => {
    if (!selectedProfileId) {
      alert("Selecciona un perfil de análisis");
      return;
    }
    setRegeneratingTab(tabId);
    setError(null);
    setToastMessage("Regenerando…");
    try {
      const activeTabId = visibleTabs.find((t) => t.id === activeReportTab)?.tabId;
      const promptOverride = activeTabId === tabId ? (aiPromptExtra?.trim() || null) : null;
      const result = await regenerateSingleModule(tabId, promptOverride);
      if (result.ok && result.report) {
        setReport(result.report);
        setToastMessage("Actualizado ✅");
        setTimeout(() => setToastMessage(null), 3000);
        setModuleStatus((s) => ({ ...s, [tabId]: "done" }));
      } else {
        setError(result.error ?? "Error regenerando módulo");
        setToastMessage(null);
        setModuleStatus((s) => ({ ...s, [tabId]: "error" }));
      }
    } catch (err: any) {
      setError(err?.message ?? "Error regenerando módulo");
      setToastMessage(null);
      setModuleStatus((s) => ({ ...s, [tabId]: "error" }));
    } finally {
      setRegeneratingTab(null);
    }
  };

  const runFullAiGeneration = async () => {
    if (!leadId?.trim()) return;
    if (!selectedProfileId) {
      alert("Selecciona un perfil de análisis");
      return;
    }

    const rollbackNotStarted = () => {
      setAnalysisPhase("NOT_STARTED");
      setAiLoading(false);
      setGenerationProfileActive(null);
      setAnalysisStartedAt(null);
    };

    /** Optimista: PROCESSING + loader antes de cualquier await (onBeforeGenerate / red). */
    setGenerationProfileActive(reportProfile);
    setAnalysisPhase("PROCESSING");
    setAiLoading(true);
    setError(null);
    setAiDoneMsg("");
    setReportExpanded(false);
    setAnalysisStartedAt(Date.now());
    setAnalysisProgress(0);
    setAnalysisCurrentModule("Preparando…");
    setAnalysisTotalModules(0);
    onBeginAnalysisGeneration?.();

    try {
      await onBeforeGenerate?.();
    } catch (e) {
      setError("Error guardando draft antes de generar.");
      rollbackNotStarted();
      return;
    }

    const promptsData = await resolveIaPromptsForExecution();
    if (!promptsData?.prompts?.modules || !hasNonEmptyModuleValues(promptsData.prompts.modules)) {
      setError(
        "No hay prompts de módulos en el servidor. Guardá la configuración en Admin → Configuración → IA (persistida en base de datos) y recargá esta página."
      );
      rollbackNotStarted();
      return;
    }

    const profile = getReportProfile(reportProfile);
    // Orden del catálogo + perfil; solo módulos con prompt no vacío en la config del servidor (no depende de visibleTabs ni de localStorage).
    const tabsWithPrompts = TABS_CONFIG.filter(
      (tab) =>
        profile.moduleIds.includes(tab.tabId) &&
        getModulePromptForTab(tab.tabId, promptsData.prompts.modules).trim().length > 0
    );
    let moduleIdsToRun = tabsWithPrompts.map((t) => t.tabId);
    const emp = (lead as any)?.empresas;
    const hasWeb = Boolean(
      lead?.website || emp?.web || emp?.website || emp?.instagram || emp?.facebook ||
      (lead as any)?.linkedin_empresa ||
      (lead as any)?.linkedin_personal ||
      (lead as any)?.linkedin_director
    );
    const adHint = `${lead?.objetivos ?? ""} ${lead?.notas ?? ""} ${(lead as any)?.ai_context ?? ""}`.toLowerCase();
    const hasPauta = adHint.includes("ads") || adHint.includes("pauta") || adHint.includes("pixel") || adHint.includes("capi");
    const shouldIncludeTech = hasWeb || hasPauta;
    const filteredIds = moduleIdsToRun.filter((id) => {
      const normalized = id.toLowerCase();
      return shouldIncludeTech || !TECH_MODULE_IDS.includes(normalized as any);
    });

    const uiModuleOrder = filteredIds
      .map((id) => tabsWithPrompts.find((t) => t.tabId === id))
      .filter(Boolean) as typeof TABS_CONFIG;
    if (uiModuleOrder.length === 0) {
      setError("Ningún módulo para generar. Revisá la config IA.");
      rollbackNotStarted();
      return;
    }

    setModuleStatus(() => {
      const next: Record<string, "idle" | "running" | "done" | "error"> = {};
      filteredIds.forEach((id) => (next[id] = "idle"));
      return next;
    });

    const totalModules = uiModuleOrder.length;
    setAnalysisStartedAt(Date.now());
    setAnalysisTotalModules(totalModules);
    setAnalysisProgress(0);
    setAnalysisCurrentModule(uiModuleOrder[0]?.label ?? "Preparando…");

    const firstTab = uiModuleOrder[0];
    setActiveReportTab(firstTab.id);

    let currentReport = report;
    for (let i = 0; i < uiModuleOrder.length; i++) {
      const tab = uiModuleOrder[i];
      setAnalysisCurrentModule(tab.label);
      setAnalysisProgress(totalModules > 0 ? Math.round((i / totalModules) * 100) : 0);
      setModuleStatus((s) => ({ ...s, [tab.tabId]: "running" }));
      setActiveReportTab(tab.id);
      // Importante: en corrida completa, cada módulo usa su propio prompt (sin heredar prompt activo global).
      const result = await regenerateSingleModule(tab.tabId, null);
      if (result.ok && result.report) {
        currentReport = result.report;
        setReport(currentReport);
        setModuleStatus((s) => ({ ...s, [tab.tabId]: "done" }));
      } else {
        setModuleStatus((s) => ({ ...s, [tab.tabId]: "error" }));
        if (result.error) setError(result.error);
      }
      setAnalysisProgress(totalModules > 0 ? Math.round(((i + 1) / totalModules) * 100) : 0);
    }

    const visionInProfile = uiModuleOrder.some(
      (tab) => tab.tabId.toLowerCase() === VISION_TAB_ID.toLowerCase()
    );
    if (visionInProfile) {
      setActiveReportTab(VISION_TAB_ID);
    } else if (uiModuleOrder.length > 0) {
      setActiveReportTab(uiModuleOrder[uiModuleOrder.length - 1].id);
    }
    /** Foco en el bloque de ejecución / resultado, no en «Módulos del análisis». */
    requestAnimationFrame(() => {
      executionScrollRef?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    setAnalysisProgress(100);
    setAnalysisCurrentModule(moduleCompleteLabel);
    setAiDoneMsg("✅ Informe IA completo.");
    setStatus("done");
    setAnalysisPhase("COMPLETED");
    setGenerationProfileActive(null);
    setAiLoading(false);
    setAnalysisStartedAt(null);
    onReportGenerated?.();
    if (!guidedStep1Mode) {
      setReportExpanded(true);
    }
  };

  const generateAI = async () => {
    console.log("[AI] click generar");
    console.log("[AI] llamando endpoint");
    await handleGenerate(false);
  };

  const handleGenerate = async (force = false, moduleId?: string) => {
    console.log("[AI] CLICK Generar IA", { force, moduleId });

    setGenerationProfileActive(reportProfile);
    setAnalysisPhase("PROCESSING");
    setAiLoading(true);
    setAnalysisStartedAt(Date.now());
    setAnalysisProgress(0);
    setAnalysisCurrentModule("Generando informe completo…");
    onBeginAnalysisGeneration?.();

    try {
      setError(null);
      setStatus("generating");

      type AiPromptsPayload = {
        base?: string;
        modules?: Record<string, string>;
      };

      type AiReportBody = {
        personalization?: string;
        force_regenerate?: boolean;
        module?: string;
        profile_id?: string;
        prompts?: AiPromptsPayload;
      };

      const personalizationText = aiPromptExtra?.trim() ? aiPromptExtra.trim() : null;
      const forceRegenerate = force;
      const moduleIdParam = moduleId;

      const body: AiReportBody = {
        personalization: personalizationText || undefined,
        force_regenerate: !!forceRegenerate,
        module: moduleIdParam || undefined,
        profile_id: selectedProfileId,
      };

      const serverPrompts = await resolveIaPromptsForExecution();
      if (serverPrompts && hasNonEmptyModuleValues(serverPrompts.prompts.modules)) {
        body.prompts = serverPrompts.prompts as AiPromptsPayload;
      }

      console.log("[AI] llamando endpoint", `/api/admin/leads/${leadId}/ai-report`);
      
      const res = await fetch(`/api/admin/leads/${leadId}/ai-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      console.log("[AI] fetch enviado", res.status);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error generando informe IA");
      }

      const data = await res.json();
      console.log("[AI] respuesta IA OK", data);

      setReport(data.data?.report ?? data.report ?? "");
      setStatus("done");
      setAnalysisPhase("COMPLETED");
      setReportExpanded(true);
    } catch (err: any) {
      console.error("[AI] ERROR generando informe", err);
      setError(err?.message ?? "Error generando informe IA. Ver consola.");
      setStatus("idle");
      const hadReportFromLead = String((lead as any)?.ai_report ?? "").trim().length > 0;
      setAnalysisPhase(hadReportFromLead ? "COMPLETED" : "NOT_STARTED");
    } finally {
      setAiLoading(false);
      setGenerationProfileActive(null);
      setAnalysisStartedAt(null);
    }
  };

  const baseName = ((lead as any)?.empresas?.nombre ?? lead?.nombre ?? "lead")
    .toString()
    .replace(/\s+/g, "-")
    .toLowerCase();

  const handleExportPdf = async (profile: "comercial" | "tecnico") => {
    try {
      setError(null);
      if (!leadId?.trim()) {
        setError("Falta el lead.");
        return;
      }
      setPdfExporting(profile);
      setToastMessage("Generando PDF…");

      const res = await fetch(
        `/api/admin/leads/${leadId}/ai-report/pdf?profile=${profile}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error ?? res.statusText ?? "Error generando PDF");
      }
      const blob = await res.blob();
      const filename = `informe-${profile}-${baseName}.pdf`;
      await downloadBlob(blob, filename);

      setToastMessage("✅ PDF descargado.");
    } catch (e: any) {
      setError(e?.message ?? "Error generando PDF");
      setToastMessage(null);
    } finally {
      setPdfExporting(null);
    }
  };

  const handleExportPdfVision = async () => {
    try {
      setError(null);
      if (!leadId?.trim()) {
        setError("Falta el lead.");
        return;
      }
      const visionContent = reportTabs["vision_estrategica"] ?? "";
      if (!visionContent?.trim()) {
        setError("No hay contenido de Visión Estratégica para exportar. Genera el informe primero.");
        return;
      }
      setPdfExporting("vision");
      setToastMessage("Generando PDF Visión Estratégica…");
      const sections = [{ name: "Visión Estratégica", content: visionContent }];
      const doc = (
        <LeadReportPdf
          title="Informe Visión Estratégica"
          subtitle="Resumen estratégico del lead"
          leadName={(lead as any)?.empresas?.nombre ?? lead?.nombre ?? ""}
          generatedAt={new Date().toLocaleString()}
          sections={sections}
          footerLeft="Cámara Costa"
          footerRight="Generado por EASY CRM"
        />
      );
      const blob = await pdf(doc).toBlob();
      await downloadBlob(blob, `informe-vision-estrategica-${baseName}.pdf`);
      setToastMessage("✅ PDF descargado.");
    } catch (e: any) {
      setError(e?.message ?? "Error generando PDF");
      setToastMessage(null);
    } finally {
      setPdfExporting(null);
    }
  };

  async function copy() {
    if (!report.trim()) return;
    await navigator.clipboard.writeText(report);
  }

  if (!hasAnyProfile) {
    return (
      <div className="rounded-2xl border bg-white p-4">
        <p className="text-sm text-slate-600">
          No tienes perfiles de IA habilitados para este lead.
        </p>
      </div>
    );
  }

  const analysisAvailable = analysisPhase === "COMPLETED" && !!report.trim();
  const lockIcon = (
    <svg className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm2-2v2h6V7a3 3 0 00-6 0v2h2z" clipRule="evenodd" />
    </svg>
  );
  const lockedTitle = ui.lockedTitle;

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div
        ref={executionScrollRef}
        id="lead-ai-execution-anchor"
        className="scroll-mt-28"
      >
      {aiDoneMsg && (
        <div className="mb-3 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 font-medium">
          {aiDoneMsg}
        </div>
      )}
      {status !== "idle" && !aiDoneMsg && analysisPhase !== "PROCESSING" && (
        <div className="mb-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {status === "saving" && "Guardando datos del lead…"}
          {status === "generating" && "Generando informe con IA…"}
          {status === "done" && "Informe generado correctamente."}
        </div>
      )}

      {/* PROCESSING: estado intermedio explícito (loader + progreso), siempre visible al generar */}
      {analysisPhase === "PROCESSING" && (
        <div
          className="mb-4 rounded-xl border-2 border-blue-400 bg-gradient-to-b from-blue-50/90 to-white px-4 py-4 shadow-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex gap-4">
            <span
              className="mt-1 inline-block h-10 w-10 shrink-0 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight text-slate-900">
                {generationProfileActive === "tecnico" ? ui.genTech : ui.genCommercial}
              </h3>
              <p className="mt-1 text-sm text-slate-600">Esto puede tardar unos segundos</p>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                {analysisTotalModules <= 0 ? (
                  <div className="h-full w-2/5 animate-pulse rounded-full bg-blue-500" />
                ) : (
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out"
                    style={{ width: `${analysisPercent}%` }}
                    role="progressbar"
                    aria-valuenow={analysisPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={ui.progressAria}
                  />
                )}
              </div>
              {analysisTotalModules > 0 && (
                <p className="mt-2 text-xs font-semibold text-slate-700">{analysisPercent}% completado</p>
              )}
              {analysisCurrentModule && analysisPercent < 100 && (
                <p className="mt-1.5 text-xs font-medium text-slate-700">Módulo actual: {analysisCurrentModule}</p>
              )}
              {analysisTotalModules > 0 && analysisPercent < 100 && (
                <p className="mt-1 text-xs text-slate-500">
                  {analysisEstimatedRemaining != null
                    ? `Tiempo estimado restante: ${formatTime(analysisEstimatedRemaining)}`
                    : "Calculando tiempo estimado…"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Zona A — Acción principal (título siempre; botones ocultos en paso 1 guiado mientras PROCESSING) */}
      <div className="mb-4">
        <div className="text-sm font-semibold text-slate-900">
          {titleLabel ?? "Agente IA · Informe del Lead"}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {subtitleLabel ?? ui.defaultSubtitle}
        </div>
        <div className="mt-3 max-w-md">
          <label className="block text-xs font-medium text-slate-700">Perfil de análisis</label>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            disabled={isProcessingPhase || loadingProfiles}
          >
            <option value="">{loadingProfiles ? "Cargando perfiles..." : "Seleccionar perfil..."}</option>
            {analysisProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {!(guidedStep1Mode && isProcessingPhase) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isProcessingPhase ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl bg-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 cursor-not-allowed"
            >
              <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-400 border-t-slate-600" aria-hidden />
              Generando…
            </button>
          ) : analysisPhase === "COMPLETED" && report.trim() ? (
            <span
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500 opacity-90"
              title={ui.alreadyTooltip}
            >
              <svg className="h-4 w-4 shrink-0" aria-hidden fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm2-2v2h6V7a3 3 0 00-6 0v2h2z" clipRule="evenodd" />
              </svg>
              {ui.alreadyChip}
            </span>
          ) : buttonTooltipContent ? (
            <Tooltip content={buttonTooltipContent} maxWidth="320px">
              <span className="inline-block">
                <button
                  type="button"
                  onClick={runFullAiGeneration}
                  disabled={loadingProfiles || !selectedProfileId}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Analizar
                </button>
              </span>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={runFullAiGeneration}
              disabled={loadingProfiles || !selectedProfileId}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Analizar
            </button>
          )}
          {buttonHelperText && <p className="mt-1.5 text-xs text-slate-500 max-w-md">{buttonHelperText}</p>}
        </div>
        )}
      </div>

      {guidedStep1Mode && !isProcessingPhase && analysisAvailable && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">{ui.bannerDone}</p>
          <p className="mt-0.5 text-xs text-emerald-800">Documento principal disponible</p>
          {onNextStepClick && (
            <button
              type="button"
              onClick={onNextStepClick}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {nextStepCtaLabel ?? "Ir al diagnóstico comercial"}
            </button>
          )}
        </div>
      )}

      {guidedStep1Mode && !isProcessingPhase && analysisAvailable && (
        <div className="mb-4 space-y-3">
          <details className="rounded-lg border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">Informe comercial</summary>
            <p className="mt-1 text-xs text-slate-500">{ui.docPrincipal}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setReportProfile("comercial");
                  const firstModuleId = getReportProfile("comercial").moduleIds[0];
                  const firstTab = TABS_CONFIG.find((t) => t.tabId === firstModuleId);
                  setActiveReportTab(firstTab?.id ?? TABS_CONFIG[0].id);
                  setReportExpanded(true);
                  requestAnimationFrame(() => setTimeout(() => modulePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80));
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50"
              >
                Ver informe
              </button>
              <button
                type="button"
                onClick={() => handleExportPdf("comercial")}
                disabled={!leadId || pdfExporting !== null}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pdfExporting === "comercial" ? "Generando PDF..." : "PDF informe comercial"}
              </button>
            </div>
          </details>

          <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">{ui.modulosDestacados}</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setActiveReportTab("vision_estrategica")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50">Ver visión estratégica</button>
              <button type="button" onClick={handleExportPdfVision} disabled={!leadId || pdfExporting !== null} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">{pdfExporting === "vision" ? "Generando PDF..." : "PDF visión estratégica"}</button>
              <button type="button" onClick={() => generateGammaProposal("comercial")} disabled={!leadId || gammaLoading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">{gammaLoading ? "Generando Gamma..." : "Generar Gamma de visión estratégica"}</button>
            </div>
          </details>

          <details className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-violet-800">Personalización IA</summary>
            <p className="mt-1 text-xs text-violet-700">{ui.personalize}</p>
          </details>

          <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">{ui.modulesDetails}</summary>
            <p className="mt-1 text-xs text-slate-600">Selector de módulos y contenido detallado del informe.</p>
          </details>
        </div>
      )}

      {/* Zona B — Documentos generados (reorganizado: principal, módulos destacados, exportaciones) */}
      {!guidedStep1Mode && !isProcessingPhase && (
      <div className="mb-4 space-y-4">
        {/* 1. BLOQUE PRINCIPAL — Informe comercial */}
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Informe comercial</h3>
          <p className="mt-0.5 text-xs text-slate-500">{ui.docPrincipal}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canUseCommercial && (
              analysisAvailable ? (
                <button
                  type="button"
                  onClick={() => {
                    setReportProfile("comercial");
                    const firstModuleId = getReportProfile("comercial").moduleIds[0];
                    const firstTab = TABS_CONFIG.find((t) => t.tabId === firstModuleId);
                    setActiveReportTab(firstTab?.id ?? TABS_CONFIG[0].id);
                    setReportExpanded(true);
                    requestAnimationFrame(() => {
                      setTimeout(() => {
                        modulePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 80);
                    });
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50"
                  title="Expandir y ver el informe comercial debajo"
                >
                  Ver informe
                </button>
              ) : (
                <span
                  className="inline-flex cursor-not-allowed items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500 opacity-60"
                  title={lockedTitle}
                >
                  {lockIcon}
                  Ver informe
                </span>
              )
            )}
            {canUseCommercial && (
              analysisAvailable ? (
                <button
                  type="button"
                  onClick={() => handleExportPdf("comercial")}
                  disabled={!leadId || pdfExporting !== null}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                  title={pdfExporting === "comercial" ? "Generando PDF…" : "Descargar PDF del informe comercial"}
                >
                  {pdfExporting === "comercial" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden />
                      Generando PDF…
                    </span>
                  ) : (
                    "PDF informe comercial"
                  )}
                </button>
              ) : (
                <span
                  className="inline-flex cursor-not-allowed items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500 opacity-60 min-w-[140px]"
                  title={lockedTitle}
                >
                  {lockIcon}
                  PDF informe comercial
                </span>
              )
            )}
          </div>
        </div>

        {/* 2. BLOQUE SECUNDARIO — Módulos destacados */}
        {canUseCommercial && (!analysisAvailable || (reportTabs["vision_estrategica"]?.trim() ?? "").length > 0) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <h3 className="text-sm font-semibold text-slate-800">{ui.modulosDestacadosH3}</h3>
            <p className="mt-0.5 text-xs text-slate-500">Secciones clave derivadas del informe comercial.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {analysisAvailable && (reportTabs["vision_estrategica"]?.trim() ?? "").length > 0 ? (
                <button type="button" onClick={() => setActiveReportTab("vision_estrategica")} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100" title="Ver módulo Visión Estratégica">Ver visión estratégica</button>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm font-medium text-blue-600 opacity-60" title={lockedTitle}>{lockIcon}Ver visión estratégica</span>
              )}
              {analysisAvailable && (reportTabs["vision_estrategica"]?.trim() ?? "").length > 0 ? (
                <button
                  type="button"
                  onClick={handleExportPdfVision}
                  disabled={!leadId || pdfExporting !== null}
                  className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                  title={pdfExporting === "vision" ? "Generando PDF…" : "Descargar PDF Visión Estratégica"}
                >
                  {pdfExporting === "vision" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" aria-hidden />
                      Generando PDF…
                    </span>
                  ) : (
                    "PDF visión estratégica"
                  )}
                </button>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm font-medium text-blue-600 opacity-60 min-w-[140px]" title={lockedTitle}>{lockIcon}PDF visión estratégica</span>
              )}
              {analysisAvailable && (reportTabs["vision_estrategica"]?.trim() ?? "").length > 0 ? (
                <button type="button" onClick={() => { setActiveReportTab("vision_estrategica"); regenerateTab("vision_estrategica"); }} disabled={aiLoading || regeneratingTab === "vision_estrategica"} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5" title="Regenerar módulo Visión Estratégica">
                  {regeneratingTab === "vision_estrategica" ? (<><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />Generando...</>) : "Regenerar visión estratégica"}
                </button>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm font-medium text-blue-600 opacity-60" title={lockedTitle}>{lockIcon}Regenerar visión estratégica</span>
              )}
            </div>
          </div>
        )}

        {/* 3. BLOQUE TERCIARIO — Exportaciones y acciones (Gamma y PDF centralizados aquí) */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <h3 className="text-sm font-semibold text-slate-800">Exportaciones y acciones</h3>
          <p className="mt-0.5 text-xs text-slate-500">Exportar o reutilizar contenido en otros formatos.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canUseCommercial && (
              analysisAvailable ? (
                <button
                  type="button"
                  onClick={() => generateGammaProposal("comercial")}
                  disabled={!leadId || gammaLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]"
                  title={gammaLoading ? "Generando…" : "Crear propuesta en Gamma"}
                >
                  {gammaLoading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" aria-hidden />
                      Generando Gamma…
                    </span>
                  ) : (
                    "Generar Gamma comercial"
                  )}
                </button>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500 opacity-60 min-w-[160px]" title={lockedTitle}>{lockIcon}Generar Gamma comercial</span>
              )
            )}
            {canUseTechnical && (
              analysisAvailable ? (
                <button
                  type="button"
                  onClick={() => generateGammaProposal("tecnico")}
                  disabled={!leadId || gammaLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]"
                  title={gammaLoading ? "Generando…" : "Crear propuesta en Gamma"}
                >
                  {gammaLoading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" aria-hidden />
                      Generando Gamma…
                    </span>
                  ) : (
                    "Generar Gamma técnico"
                  )}
                </button>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500 opacity-60 min-w-[160px]" title={lockedTitle}>{lockIcon}Generar Gamma técnico</span>
              )
            )}
            {canUseTechnical && (
              analysisAvailable ? (
                <button
                  type="button"
                  onClick={() => handleExportPdf("tecnico")}
                  disabled={!leadId || pdfExporting !== null}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                  title={pdfExporting === "tecnico" ? "Generando PDF…" : "Descargar PDF Informe Técnico"}
                >
                  {pdfExporting === "tecnico" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden />
                      Generando PDF…
                    </span>
                  ) : (
                    "PDF informe técnico"
                  )}
                </button>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500 opacity-60 min-w-[140px]" title={lockedTitle}>{lockIcon}PDF informe técnico</span>
              )
            )}
          </div>

          {/* Gamma: progreso y resultado solo dentro de este bloque */}
          {gammaLoading && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-sm font-medium text-slate-800">Generando propuesta en Gamma…</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-slate-600 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, gammaProgress))}%` }}
                  role="progressbar"
                  aria-valuenow={gammaProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progreso de generación Gamma"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-700">{gammaProgress}%</p>
              <p className="mt-1 text-xs text-slate-600">
                {gammaProgress < 15
                  ? "Calculando tiempo estimado…"
                  : gammaProgress > 95
                    ? "Finalizando…"
                    : gammaEstimatedRemaining != null
                      ? `Tiempo estimado restante: ${formatTime(gammaEstimatedRemaining)}`
                      : "Calculando tiempo estimado…"}
              </p>
              {gammaGenerationId && (
                <p className="mt-1 text-xs text-slate-500">ID: {gammaGenerationId}</p>
              )}
            </div>
          )}
          {gammaError && !gammaLoading && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {gammaError}
            </div>
          )}
          {(gammaPdfUrl || gammaUrl) && !gammaLoading && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="mb-1 text-sm font-medium text-slate-800">Salida desde Gamma</p>
              <p className="mb-2 text-xs text-slate-600">
                El CRM solo toma como documento oficial el PDF archivado en almacenamiento propio. Los enlaces a gamma.app son vista previa externa, no el repositorio final.
              </p>
              {gammaStablePdfUrl ? (
                <p className="mb-2 text-xs font-medium text-emerald-800">PDF archivado en el CRM — usá «Descargar PDF (CRM)».</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {gammaUrl ? (
                  <button
                    type="button"
                    onClick={() => window.open(gammaUrl, "_blank")}
                    className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
                  >
                    Abrir en Gamma (externo)
                  </button>
                ) : null}
                {gammaPdfUrl && (
                  <>
                    <button
                      type="button"
                      disabled={
                        isTransientGammaExportPdfUrl(gammaPdfUrl) &&
                        (!gammaStablePdfUrl || gammaMirrorBusy)
                      }
                      onClick={() => {
                        const target = isTransientGammaExportPdfUrl(gammaPdfUrl)
                          ? gammaStablePdfUrl
                          : gammaPdfUrl;
                        if (target) window.open(target, "_blank");
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {gammaMirrorBusy && isTransientGammaExportPdfUrl(gammaPdfUrl)
                        ? "Archivando PDF en CRM…"
                        : "Descargar PDF (CRM)"}
                    </button>
                    {gammaMirrorError && isTransientGammaExportPdfUrl(gammaPdfUrl) ? (
                      <div className="w-full mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <p>{gammaMirrorError}</p>
                        <button
                          type="button"
                          onClick={() => void retryGammaMirror()}
                          disabled={gammaMirrorBusy}
                          className="mt-2 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                        >
                          Reintentar archivar PDF
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Bloque separado: Personalización IA */}
      {!guidedStep1Mode && !isProcessingPhase && (
      <details className="mb-4 rounded-lg border border-violet-200 bg-violet-50/30">
        <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-violet-800 hover:bg-violet-100/50 rounded-lg">
          Personalización IA
        </summary>
        <div className="border-t border-violet-100 p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {canUseCommercial && (
              <button type="button" onClick={() => fetchGammaPrompt("comercial")} disabled={!leadId || gammaPromptLoading} className="rounded-lg border border-violet-200 px-3 py-2 text-sm font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50" title="Ver/editar prompt para Gamma comercial">{gammaPromptLoading ? "..." : "Editar Prompt Gamma Comercial"}</button>
            )}
            {canUseTechnical && (
              <button type="button" onClick={() => fetchGammaPrompt("tecnico")} disabled={!leadId || gammaPromptLoading} className="rounded-lg border border-violet-200 px-3 py-2 text-sm font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50" title="Ver/editar prompt para Gamma técnico">{gammaPromptLoading ? "..." : "Editar Prompt Gamma Técnico"}</button>
            )}
          </div>
          <div>
            <label htmlFor="ai-prompt-extra" className="block text-xs font-medium text-slate-700 mb-1">{ui.extraLabel}</label>
            <textarea id="ai-prompt-extra" value={aiPromptExtra} onChange={(e) => setAiPromptExtra(e.target.value)} disabled={aiLoading} placeholder="Ejemplo: Enfocarse en oportunidades de membresía premium y eventos corporativos." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[72px] disabled:opacity-50" rows={2} />
          </div>
        </div>
      </details>
      )}

      {/* Bloque: módulos del informe — oculto mientras corre la generación (contenido secundario) */}
      {!guidedStep1Mode && !isProcessingPhase && (
      <div ref={tabsBarRef} className="mb-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">{ui.modulesDetails}</p>
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => {
            const hasMissingData = missingDataByTab[tab.tabId]?.faltantes.length > 0;
            const isActive = activeReportTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveReportTab(tab.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${isActive ? "bg-slate-900 text-white border-slate-900" : `${categoryBadgeClass(tab.categoryColor ?? "slate")} border-slate-300 hover:brightness-95`}`}
                title={tab.label}
              >
                {tab.label}
                {hasMissingData && <span className="ml-1 text-amber-500" title="Faltan datos">⚠</span>}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {toastMessage && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
          {toastMessage.includes("✅") ? (
            <span className="text-green-600">✅</span>
          ) : (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></span>
          )}
          {toastMessage}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isProcessingPhase && (
      <div className="mt-4">
        {!report.trim() ? (
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
            Aún no hay informe. Tocá <span className="font-semibold">Generar IA</span>.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setReportExpanded(v => !v)}
              className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
            >
              {reportExpanded ? "Colapsar informe" : "Ver informe"}
            </button>

            {reportExpanded ? (
              <div className="mt-4">
                {/* Contenido del tab activo (selector de módulos está solo en el bloque "Módulos del análisis" más arriba) */}
                <div ref={modulePanelRef} className="rounded-xl border bg-white p-6">
                  {/* Título del módulo: barra negra estilo consultoría premium */}
                  <div className={`font-semibold text-[15px] px-3 py-2 rounded-md mb-3 ${categoryBadgeClass((visibleTabs.find(t => t.id === activeReportTab)?.categoryColor ?? "slate"))}`}>
                    {visibleTabs.find(t => t.id === activeReportTab)?.label ?? TABS_CONFIG.find(t => t.id === activeReportTab)?.label ?? "Tab"}
                  </div>
                  <div className="mb-4 space-y-3 border-b border-slate-200 pb-3">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const activeTabConfig = visibleTabs.find(t => t.id === activeReportTab) ?? TABS_CONFIG.find(t => t.id === activeReportTab);
                          if (activeTabConfig) {
                            regenerateTab(activeTabConfig.tabId);
                          }
                        }}
                        disabled={regeneratingTab === (visibleTabs.find(t => t.id === activeReportTab) ?? TABS_CONFIG.find(t => t.id === activeReportTab))?.tabId}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {regeneratingTab === (visibleTabs.find(t => t.id === activeReportTab) ?? TABS_CONFIG.find(t => t.id === activeReportTab))?.tabId ? (
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></span>
                            Regenerando...
                          </span>
                        ) : (
                          "Regenerar este módulo"
                        )}
                      </button>
                    </div>
                    
                    {/* Prompt en uso (personalización por lead, editable) — colapsado por defecto */}
                    <details className="rounded-lg border border-blue-200 bg-blue-50">
                      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100/50 rounded-lg">
                        <Tooltip content="Muestra el prompt del módulo activo (global, legacy o personalizado). Herramienta avanzada para revisar o editar." maxWidth="280px">
                          <span className="inline-block">▼ Prompt en uso</span>
                        </Tooltip>
                      </summary>
                      <div className="p-3 pt-0 border-t border-blue-100">
                        <p className="text-xs text-blue-700 mb-2">
                          Este prompt corresponde solo al módulo activo de este lead. El prompt global no se modifica.
                        </p>
                      {promptSavedMessage && (
                        <div className="mb-2 rounded border border-green-300 bg-green-50 px-2 py-1.5 text-xs text-green-800">
                          {promptSavedMessage}
                        </div>
                      )}
                      {promptError && (
                        <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                          {promptError}
                        </div>
                      )}
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            moduleCustomPrompt?.trim()
                              ? "bg-amber-100 text-amber-800"
                              : parsedCustomPrompt.legacyText && visiblePrompt === parsedCustomPrompt.legacyText.trim()
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {moduleCustomPrompt?.trim()
                            ? "Prompt personalizado de este módulo"
                            : parsedCustomPrompt.legacyText && visiblePrompt === parsedCustomPrompt.legacyText.trim()
                              ? "Prompt legacy del lead"
                              : "Prompt global del módulo"}
                        </span>
                      </div>

                      {!isEditingPrompt ? (
                        <>
                          <div className="mb-2 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-mono text-slate-700 whitespace-pre-wrap min-h-[80px] max-h-48 overflow-y-auto">
                            {visiblePrompt || "(Sin prompt definido para este módulo)"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAiPromptExtra(visiblePrompt);
                                setIsEditingPrompt(true);
                              }}
                              className="rounded-lg border border-blue-300 bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-200"
                            >
                              Editar prompt
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <textarea
                            value={aiPromptExtra}
                            onChange={(e) => setAiPromptExtra(e.target.value)}
                            placeholder="Prompt del módulo activo. Editá y guardá para fijar un prompt personalizado solo para este módulo."
                            className="mb-2 w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-800 min-h-[80px] resize-y"
                            rows={4}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={savePromptToLead}
                              disabled={savingPrompt}
                              className="rounded-lg border border-blue-300 bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-200 disabled:opacity-50"
                            >
                              {savingPrompt ? "Guardando…" : "Guardar prompt del lead"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelPromptEdit}
                              disabled={savingPrompt}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Cancelar edición
                            </button>
                            <button
                              type="button"
                              onClick={restoreGlobalPrompt}
                              disabled={savingPrompt}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Restaurar prompt global
                            </button>
                          </div>
                        </>
                      )}
                      </div>
                    </details>

                    {/* Comparación por módulo: solo cuando este módulo tiene custom */}
                    {moduleCustomPrompt?.trim() && (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-800 mb-2">Comparación de prompt (este módulo)</div>
                        <p className="text-xs text-slate-600 mb-3">
                          Este módulo usa una versión personalizada. El prompt global del módulo no se modifica.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-medium text-slate-700 mb-1">Prompt global del módulo</div>
                            <div className="rounded border border-slate-200 bg-white p-2 max-h-40 overflow-y-auto text-xs font-mono text-slate-700 whitespace-pre-wrap">
                              {globalModulePrompt || "(Sin prompt global del módulo)"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-700 mb-1">Prompt personalizado de este módulo</div>
                            <div className="rounded border border-slate-200 bg-white p-2 max-h-40 overflow-y-auto text-xs font-mono text-slate-700 whitespace-pre-wrap">
                              {moduleCustomPrompt || "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {(() => {
                    // Buscar el tab activo en TABS_CONFIG
                    const activeTabConfig = visibleTabs.find(t => t.id === activeReportTab) ?? TABS_CONFIG.find(t => t.id === activeReportTab);
                    if (!activeTabConfig) {
                      return (
                        <div className="text-slate-500 italic">Tab no encontrado.</div>
                      );
                    }
                    
                    // Obtener contenido desde reportTabs usando tabId
                    const rawSectionContent = reportTabs[activeTabConfig.tabId] || "";
                    
                    // Extraer datos faltantes
                    const missingData = missingDataByTab[activeTabConfig.tabId] || { faltantes: [], preguntas: [], dondeCargar: [] };
                    const hasMissingData = missingData.faltantes.length > 0 || missingData.preguntas.length > 0 || missingData.dondeCargar.length > 0;
                    
                    // Remover secciones de datos faltantes del contenido para no duplicarlas
                    const sectionContent = removeMissingDataSections(rawSectionContent);
                    const formatted = formatBullets(formatLevels(formatAiText(sectionContent)));
                    const hasContent = sectionContent.trim() && 
                      !sectionContent.includes("Error generando") && 
                      !sectionContent.includes("Sin contenido generado");
                    
                    if (!hasContent && !hasMissingData) {
                      return (
                        <div className="text-slate-500 italic">
                          Sin contenido aún.
                        </div>
                      );
                    }
                    
                    if (viewMode === "raw") {
                      return (
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono">
                          {rawSectionContent}
                        </pre>
                      );
                    }
                    
                    return (
                      <div className="prose max-w-none">
                        {/* Bloque destacado de datos faltantes */}
                        {hasMissingData && (
                          <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-amber-900">
                                Faltan datos para mejorar precisión
                              </h4>
                              {missingData.preguntas.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => copyQuestions(missingData.preguntas)}
                                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                                >
                                  Copiar preguntas
                                </button>
                              )}
                            </div>
                            
                            {missingData.faltantes.length > 0 && (
                              <div className="mb-3">
                                <div className="text-xs font-semibold text-amber-800 mb-1.5">Faltantes:</div>
                                <ul className="list-disc list-inside space-y-1 text-xs text-amber-700">
                                  {missingData.faltantes.map((falta, idx) => (
                                    <li key={idx}>{falta}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {missingData.preguntas.length > 0 && (
                              <div className="mb-3">
                                <div className="text-xs font-semibold text-amber-800 mb-1.5">Preguntas para completar:</div>
                                <ol className="list-decimal list-inside space-y-1 text-xs text-amber-700">
                                  {missingData.preguntas.map((pregunta, idx) => (
                                    <li key={idx}>{pregunta}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            
                            {missingData.dondeCargar.length > 0 && (
                              <div className="mb-3">
                                <div className="text-xs font-semibold text-amber-800 mb-1.5">Dónde cargarlo en el CRM:</div>
                                <ul className="list-disc list-inside space-y-1 text-xs text-amber-700">
                                  {missingData.dondeCargar.map((donde, idx) => (
                                    <li key={idx}>{donde}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Textarea para respuestas a faltantes */}
                            <div className="mt-4 border-t border-amber-300 pt-3">
                              <label htmlFor="missing-answers" className="block text-xs font-semibold text-amber-900 mb-1.5">
                                Responder faltantes (se agregará a Personalización IA)
                              </label>
                              <textarea
                                id="missing-answers"
                                value={missingAnswersText}
                                onChange={(e) => setMissingAnswersText(e.target.value)}
                                placeholder="Ejemplo: Website: https://ejemplo.com. Objetivos: Expandir red de contactos B2B, participar en eventos sectoriales."
                                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-amber-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-0 resize-y min-h-[60px] disabled:opacity-50 disabled:cursor-not-allowed"
                                rows={3}
                                disabled={aiLoading || regeneratingTab !== null}
                              />
                              <div className="mt-2 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const activeTabConfig = visibleTabs.find(t => t.id === activeReportTab) ?? TABS_CONFIG.find(t => t.id === activeReportTab);
                                    if (activeTabConfig) {
                                      addMissingAnswersToPersonalization(activeTabConfig.tabId, activeTabConfig.label);
                                    }
                                  }}
                                  disabled={!missingAnswersText.trim() || aiLoading || regeneratingTab !== null}
                                  className="rounded-lg border border-amber-600 bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Agregar a Personalización IA
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {hasContent && (
                          <div className="text-[14px] leading-relaxed text-gray-800 whitespace-pre-line">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                            h1: ({ children }) => (
                              <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-4 pb-2 border-b border-slate-200">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-lg font-semibold text-slate-700 mt-4 mb-2">
                                {children}
                              </h3>
                            ),
                            p: ({ children }) => <p className="text-slate-700 mb-3 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1 text-slate-700">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1 text-slate-700">{children}</ol>,
                            li: ({ children }) => <li className="ml-4">{children}</li>,
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-4">
                                <table className="min-w-full border-collapse border border-slate-300 text-sm">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-slate-100">{children}</thead>
                            ),
                            tbody: ({ children }) => <tbody>{children}</tbody>,
                            tr: ({ children }) => (
                              <tr className="border-b border-slate-200 hover:bg-slate-50">{children}</tr>
                            ),
                            th: ({ children }) => (
                              <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-slate-300 px-3 py-2 text-slate-700">{children}</td>
                            ),
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                {children}
                              </a>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-slate-300 pl-4 my-4 italic text-slate-600">
                                {children}
                              </blockquote>
                            ),
                            code: ({ children, className }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-slate-800">
                                  {children}
                                </code>
                              ) : (
                                <code className={className}>{children}</code>
                              );
                            },
                            pre: ({ children }) => (
                              <pre className="bg-slate-100 p-4 rounded-lg overflow-x-auto my-4 text-sm">
                                {children}
                              </pre>
                            ),
                            hr: () => <hr className="my-6 border-slate-300" />,
                            strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            }}
                          >
                            {formatted}
                          </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500 italic">
                Informe oculto. Presioná "Ver informe" para visualizarlo.
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Modal Prompt Gamma */}
      {gammaPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setGammaPromptOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-lg font-semibold text-slate-900">Prompt para Gamma</h3>
              <button
                type="button"
                onClick={() => setGammaPromptOpen(false)}
                className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            {gammaPromptError && (
              <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {gammaPromptError}
              </div>
            )}
            <div className="flex-1 overflow-hidden p-4">
              <textarea
                readOnly
                value={gammaPromptText}
                className="w-full h-96 min-h-[200px] rounded-xl border border-slate-200 p-4 text-sm font-mono text-slate-800 resize-y"
                placeholder="El prompt se generará al hacer clic en Comercial o Técnico."
              />
            </div>
            <div className="flex gap-2 px-4 py-3 border-t bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={copyGammaPrompt}
                disabled={!gammaPromptText}
                className="rounded-xl px-4 py-2 text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={() => setGammaPromptOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
