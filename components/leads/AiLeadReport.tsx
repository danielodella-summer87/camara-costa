"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { pdf } from "@react-pdf/renderer";
import LeadReportPdf from "@/components/pdf/LeadReportPdf";
import { getReportProfile } from "@/lib/ai/reportProfiles";
import { parseLeadCustomPrompt, serializeLeadCustomPrompt, getModuleCustomPrompt } from "@/lib/leads/customPrompt";
import { PDFDocument, StandardFonts } from "pdf-lib";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

// Configuración única de tabs
const TABS_CONFIG = [
  { id: "investigacion_digital", label: "Investigación Digital", tabId: "INVESTIGACION_DIGITAL" },
  { id: "redes_sociales", label: "Redes Sociales", tabId: "REDES_SOCIALES" },
  { id: "pauta_publicitaria", label: "Pauta Publicitaria", tabId: "PAUTA_PUBLICITARIA" },
  { id: "prestigio_ia", label: "Prestigio en IA", tabId: "PRESTIGIO_IA" },
  { id: "posicionamiento", label: "Posicionamiento en el mercado", tabId: "POSICIONAMIENTO" },
  { id: "competencia", label: "Competencia", tabId: "COMPETENCIA" },
  { id: "foda", label: "FODA", tabId: "FODA" },
  { id: "oportunidades", label: "Oportunidades", tabId: "OPORTUNIDADES" },
  { id: "acciones", label: "Acciones", tabId: "ACCIONES" },
  { id: "materiales", label: "Materiales listos", tabId: "MATERIALES_LISTOS" },
  { id: "cierre", label: "Cierre de la venta", tabId: "CIERRE_VENTA" },
  { id: "linkedin_decision_makers", label: "LinkedIn – Tomadores de decisión", tabId: "linkedin_decision_makers" },
  { id: "north_star_metric", label: "North Star y métricas clave", tabId: "north_star_metric" },
  { id: "producto_servicio_estrella", label: "Producto / Servicio estrella", tabId: "producto_servicio_estrella" },
  { id: "auditoria_tecnica_basica", label: "Auditoría técnica básica", tabId: "auditoria_tecnica_basica" },
  { id: "plan_crecimiento", label: "Plan de crecimiento", tabId: "plan_crecimiento" },
  { id: "propuesta_easy", label: "Propuesta de crecimiento EASY", tabId: "propuesta_easy" },
  { id: "oportunidades_negocio_easy", label: "Oportunidades de negocio EASY", tabId: "oportunidades_negocio_easy" },
  { id: "vision_estrategica", label: "Visión Estratégica", tabId: "vision_estrategica" },
] as const;

const TECH_MODULE_IDS = ["north_star_metric", "producto_servicio_estrella", "auditoria_tecnica_basica"] as const;

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

export function AiLeadReport({
  leadId,
  lead,
  onBeforeGenerate,
  onPromptSaved,
  allowedProfiles = ["comercial", "tecnico"],
  initialProfile,
  onPresentationSignalChange,
  titleLabel,
  subtitleLabel,
  buttonHelperText,
  buttonTooltipContent,
}: {
  leadId: string;
  lead?: LeadMini | null;
  onBeforeGenerate?: () => Promise<void>;
  onPromptSaved?: () => void;
  allowedProfiles?: AiProfile[];
  initialProfile?: AiProfile;
  onPresentationSignalChange?: (signals: {
    gammaUrl?: string | null;
    pdfUrl?: string | null;
    lastGeneratedPdf?: boolean;
    exportReady?: boolean;
  }) => void;
  /** Cuando se usa en el tab Comercial: título del bloque (ej. "Análisis interno del lead (IA)") */
  titleLabel?: string;
  /** Subtítulo explicativo del bloque */
  subtitleLabel?: string;
  /** Texto breve debajo del botón principal de generación */
  buttonHelperText?: string;
  /** Contenido del tooltip al pasar el mouse sobre el botón de generación comercial */
  buttonTooltipContent?: string;
}) {
  const canUseCommercial = allowedProfiles.includes("comercial");
  const canUseTechnical = allowedProfiles.includes("tecnico");
  const hasAnyProfile = canUseCommercial || canUseTechnical;

  const [aiLoading, setAiLoading] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [status, setStatus] = useState<"idle" | "saving" | "generating" | "done">("idle");
  const [aiPromptExtra, setAiPromptExtra] = useState<string>("");
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSavedMessage, setPromptSavedMessage] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [reportExpanded, setReportExpanded] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<string>(TABS_CONFIG[0].id);
  const [regeneratingTab, setRegeneratingTab] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [missingAnswersText, setMissingAnswersText] = useState<string>("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [globalConfigFromApi, setGlobalConfigFromApi] = useState<{ basePrompt: string; modulos: Record<string, string> } | null>(null);

  const [moduleStatus, setModuleStatus] = useState<Record<string, "idle" | "running" | "done" | "error">>({});
  const [aiDoneMsg, setAiDoneMsg] = useState<string>("");
  const [reportProfile, setReportProfile] = useState<AiProfile>(() => {
    if (initialProfile && allowedProfiles.includes(initialProfile)) return initialProfile;
    if (canUseCommercial) return "comercial";
    if (canUseTechnical) return "tecnico";
    return "comercial";
  });
  const [gammaPromptOpen, setGammaPromptOpen] = useState(false);
  const [gammaPromptText, setGammaPromptText] = useState("");
  const [gammaPromptLoading, setGammaPromptLoading] = useState(false);
  const [gammaPromptError, setGammaPromptError] = useState<string | null>(null);
  const [gammaLoading, setGammaLoading] = useState(false);
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);
  const [gammaPdfUrl, setGammaPdfUrl] = useState<string | null>(null);
  const [gammaError, setGammaError] = useState<string | null>(null);
  const [gammaGenerationId, setGammaGenerationId] = useState<string | null>(null);
  const moduleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabsBarRef = useRef<HTMLDivElement | null>(null);
  const modulePanelRef = useRef<HTMLDivElement | null>(null);

  const VISION_TAB_ID = "vision_estrategica";

  useEffect(() => {
    if (!onPresentationSignalChange) return;
    if (gammaUrl?.trim() || gammaPdfUrl?.trim()) {
      onPresentationSignalChange({
        gammaUrl: gammaUrl ?? null,
        pdfUrl: gammaPdfUrl ?? null,
        exportReady: true,
      });
    }
  }, [gammaUrl, gammaPdfUrl, onPresentationSignalChange]);

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

  const pollGammaStatus = async (generationId: string) => {
    for (let i = 0; i < 45; i++) {
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
        setGammaLoading(false);
        setGammaError(null);
        onPresentationSignalChange?.({
          gammaUrl: gammaUrlVal ?? null,
          pdfUrl: pdfUrl ?? null,
          exportReady: Boolean(gammaUrlVal || pdfUrl),
        });
        if (pdfUrl) {
          setToastMessage("PDF Gamma listo");
          setTimeout(() => setToastMessage(null), 3000);
          window.open(pdfUrl, "_blank");
        } else if (gammaUrlVal) {
          setToastMessage("Gamma lista");
          setTimeout(() => setToastMessage(null), 3000);
          window.open(gammaUrlVal, "_blank");
        }
        return;
      }

      if (json?.status === "failed") {
        setGammaLoading(false);
        setGammaError("Gamma no pudo completar la propuesta.");
        return;
      }

      await new Promise((r) => setTimeout(r, 4000));
    }

    setGammaLoading(false);
    setGammaError("Gamma sigue procesando. Puedes reintentar abrir el estado en unos minutos.");
  };

  const generateGammaProposal = async (profile: "comercial" | "tecnico") => {
    if (!leadId?.trim()) return;
    setGammaLoading(true);
    setGammaError(null);
    setGammaUrl(null);
    setGammaPdfUrl(null);
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
      await pollGammaStatus(generationId);
    } catch (e: any) {
      setGammaError(e?.message ?? "Error generando propuesta en Gamma");
      setGammaLoading(false);
    }
  };

  const visibleTabs = useMemo(
    () =>
      TABS_CONFIG.filter((tab) =>
        getReportProfile(reportProfile).moduleIds.includes(tab.tabId)
      ),
    [reportProfile]
  );

  // Cargar prompt global real desde API (misma fuente que el backend)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/config/ia", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const data = (json as { data?: { basePrompt?: string; modulos?: Record<string, string> } | null })?.data;
        if (data) {
          const next = {
            basePrompt: typeof data.basePrompt === "string" ? data.basePrompt : "",
            modulos: data.modulos && typeof data.modulos === "object" && !Array.isArray(data.modulos) ? data.modulos : {},
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

  const keepTabsInView = () => {
    tabsBarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const canRun = !!(leadId && leadId.trim());

  // Inicializar report desde el lead cuando se carga o cambia
  useEffect(() => {
    const initialReport = (lead as any)?.ai_report ?? "";
    if (initialReport && initialReport.trim()) {
      setReport(initialReport);
      setReportExpanded(true); // Auto-expandir cuando hay informe
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

  // Helper para leer prompts desde localStorage con timestamps
  const getAiPromptsFromLocalStorage = (): {
    prompts: { base?: string; modules?: Record<string, string> };
    meta: { updated_at: { base?: number; modules?: Record<string, number> } };
  } | null => {
    try {
      const stored = localStorage.getItem("camara_costa_ai_prompts_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Si no tiene meta, crear estructura con timestamps actuales
        const now = Date.now();
        const meta = parsed.meta || {
          updated_at: {
            base: parsed.base ? now : undefined,
            modules: {} as Record<string, number>,
          },
        };
        
        // Asegurar que cada módulo tenga timestamp
        if (parsed.modules) {
          Object.keys(parsed.modules).forEach((key) => {
            if (!meta.updated_at.modules?.[key]) {
              meta.updated_at.modules = meta.updated_at.modules || {};
              meta.updated_at.modules[key] = now;
            }
          });
        }
        
        return {
          prompts: { base: parsed.base, modules: parsed.modules },
          meta,
        };
      }
    } catch (e) {
      console.warn("[AI] Error leyendo prompts desde localStorage:", e);
    }
    return null;
  };

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

  // Regenera un solo módulo; retorna { ok, report, error } para uso en loop o manual
  const regenerateSingleModule = async (tabId: string): Promise<{ ok: boolean; report?: string; error?: string }> => {
    if (!leadId?.trim()) return { ok: false, error: "Sin leadId" };
    const promptsData = getAiPromptsFromLocalStorage();
    if (!promptsData) return { ok: false, error: "No se encontraron prompts en localStorage" };

    const customPromptValue = aiPromptExtra?.trim() ? aiPromptExtra.trim() : null;
    const onlyModule = (tabId ?? "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
    const modulePrompt = getModulePromptForTab(tabId, promptsData.prompts.modules);
    const body = {
      custom_prompt: customPromptValue,
      personalization: customPromptValue,
      force_regenerate: true,
      only_module: onlyModule,
      profile: reportProfile,
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
    setRegeneratingTab(tabId);
    setError(null);
    setToastMessage("Regenerando…");
    try {
      const result = await regenerateSingleModule(tabId);
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
    try {
      await onBeforeGenerate?.();
    } catch (e) {
      setError("Error guardando draft antes de generar.");
      return;
    }

    setAiLoading(true);
    setError(null);
    setAiDoneMsg("");
    setReportExpanded(true);

    const promptsData = getAiPromptsFromLocalStorage();
    if (!promptsData?.prompts?.modules) {
      setError("No hay módulos en la config IA. Configurá en Admin → Configuración → IA.");
      setAiLoading(false);
      return;
    }

    const profile = getReportProfile(reportProfile);
    const availableByLower = new Map(
      Object.keys(promptsData.prompts.modules).map((k) => [k.toLowerCase(), k])
    );
    let moduleIdsToRun = profile.moduleIds
      .map((id) => availableByLower.get(id.toLowerCase()))
      .filter(Boolean) as string[];
    const emp = (lead as any)?.empresas;
    const hasWeb = Boolean(
      lead?.website || emp?.web || emp?.website || emp?.instagram || emp?.facebook ||
      (lead as any)?.linkedin_empresa || (lead as any)?.linkedin_director
    );
    const adHint = `${lead?.objetivos ?? ""} ${lead?.notas ?? ""} ${(lead as any)?.ai_context ?? ""}`.toLowerCase();
    const hasPauta = adHint.includes("ads") || adHint.includes("pauta") || adHint.includes("pixel") || adHint.includes("capi");
    const shouldIncludeTech = hasWeb || hasPauta;
    const filteredIds = moduleIdsToRun.filter(
      (id) => shouldIncludeTech || !TECH_MODULE_IDS.includes(id as any)
    );

    const uiModuleOrder = filteredIds
      .map((id) => visibleTabs.find((t) => t.tabId === id))
      .filter(Boolean) as typeof visibleTabs;
    if (uiModuleOrder.length === 0) {
      setError("Ningún módulo para generar. Revisá la config IA.");
      setAiLoading(false);
      return;
    }

    setModuleStatus(() => {
      const next: Record<string, "idle" | "running" | "done" | "error"> = {};
      filteredIds.forEach((id) => (next[id] = "idle"));
      return next;
    });

    keepTabsInView();

    const firstTab = uiModuleOrder[0];
    setActiveReportTab(firstTab.id);

    let currentReport = report;
    for (const tab of uiModuleOrder) {
      setModuleStatus((s) => ({ ...s, [tab.tabId]: "running" }));
      setActiveReportTab(tab.id);
      keepTabsInView();
      const result = await regenerateSingleModule(tab.tabId);
      if (result.ok && result.report) {
        currentReport = result.report;
        setReport(currentReport);
        setModuleStatus((s) => ({ ...s, [tab.tabId]: "done" }));
        keepTabsInView();
      } else {
        setModuleStatus((s) => ({ ...s, [tab.tabId]: "error" }));
        if (result.error) setError(result.error);
      }
    }

    const visionInProfile = profile.moduleIds.some(
      (id) => id.toLowerCase() === VISION_TAB_ID.toLowerCase()
    );
    if (visionInProfile) {
      setActiveReportTab(VISION_TAB_ID);
    } else if (uiModuleOrder.length > 0) {
      setActiveReportTab(uiModuleOrder[uiModuleOrder.length - 1].id);
    }
    keepTabsInView();
    modulePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    setAiDoneMsg("✅ Informe IA completo.");
    setStatus("done");
    setAiLoading(false);
  };

  const generateAI = async () => {
    console.log("[AI] click generar");
    console.log("[AI] llamando endpoint");
    await handleGenerate(false);
  };

  const handleGenerate = async (force = false, moduleId?: string) => {
    console.log("[AI] CLICK Generar IA", { force, moduleId });

    try {
      setAiLoading(true);
      setError(null);
      setStatus("generating");

      // Leer prompts desde localStorage usando helper
      const promptsFromStorage = getAiPromptsFromLocalStorage();

      // Tipos para el body
      type AiPromptsPayload = {
        base?: string;
        modules?: Record<string, string>;
      };

      type AiReportBody = {
        personalization?: string;
        force_regenerate?: boolean;
        module?: string;
        prompts?: AiPromptsPayload;
      };

      // Personalización IA siempre incluida
      const personalizationText = aiPromptExtra?.trim() ? aiPromptExtra.trim() : null;
      const forceRegenerate = force;
      const moduleIdParam = moduleId;

      // body tipado (acepta prompts)
      const body: AiReportBody = {
        personalization: personalizationText || undefined,
        force_regenerate: !!forceRegenerate,
        module: moduleIdParam || undefined,
      };

      // Agregar prompts si existen
      if (promptsFromStorage) {
        body.prompts = promptsFromStorage.prompts as AiPromptsPayload;
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
      setReportExpanded(true);
    } catch (err: any) {
      console.error("[AI] ERROR generando informe", err);
      setError(err?.message ?? "Error generando informe IA. Ver consola.");
      setStatus("idle");
    } finally {
      setAiLoading(false);
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
      onPresentationSignalChange?.({ lastGeneratedPdf: true, exportReady: true });
    } catch (e: any) {
      setError(e?.message ?? "Error generando PDF");
      setToastMessage(null);
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
      onPresentationSignalChange?.({ lastGeneratedPdf: true, exportReady: true });
    } catch (e: any) {
      setError(e?.message ?? "Error generando PDF");
      setToastMessage(null);
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

  return (
    <div className="rounded-2xl border bg-white p-4">
      {aiDoneMsg && (
        <div className="mb-3 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 font-medium">
          {aiDoneMsg}
        </div>
      )}
      {status !== "idle" && !aiDoneMsg && (
        <div className="mb-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {status === "saving" && "Guardando datos del lead…"}
          {status === "generating" && "Generando informe con IA…"}
          {status === "done" && "Informe generado correctamente."}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {titleLabel ?? "Agente IA · Informe del Lead"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {subtitleLabel ?? "Genera informe técnico de oportunidades con análisis estratégico."}
          </div>
        </div>

        <div className="space-y-4">
          {/* ETAPA 1 — Generación */}
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">ETAPA 1 — Generación</div>
            <div className="flex flex-wrap gap-2">
              {canUseCommercial && (
                <div className="flex flex-col items-start">
                  {buttonTooltipContent ? (
                    <Tooltip content={buttonTooltipContent} maxWidth="320px">
                      <span className="inline-block">
                        <button
                          type="button"
                          onClick={() => {
                            setReportProfile("comercial");
                            runFullAiGeneration();
                          }}
                          disabled={aiLoading}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            aiLoading
                              ? "bg-amber-400 text-slate-900 ring-4 ring-amber-200 animate-pulse cursor-wait"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {aiLoading ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-slate-900 animate-ping" />
                              Generando...
                            </span>
                          ) : (
                            "Generar Análisis Comercial"
                          )}
                        </button>
                      </span>
                    </Tooltip>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReportProfile("comercial");
                        runFullAiGeneration();
                      }}
                      disabled={aiLoading}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        aiLoading
                          ? "bg-amber-400 text-slate-900 ring-4 ring-amber-200 animate-pulse cursor-wait"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {aiLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-slate-900 animate-ping" />
                          Generando...
                        </span>
                      ) : (
                        "Generar Análisis Comercial"
                      )}
                    </button>
                  )}
                  {buttonHelperText && (
                    <p className="mt-1.5 text-xs text-slate-500 max-w-md">{buttonHelperText}</p>
                  )}
                </div>
              )}
              {canUseTechnical && (
                <button
                  type="button"
                  onClick={() => {
                    setReportProfile("tecnico");
                    runFullAiGeneration();
                  }}
                  disabled={aiLoading}
                  className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Generar Técnico
                </button>
              )}
              {report.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveReportTab("vision_estrategica");
                    regenerateTab("vision_estrategica");
                  }}
                  disabled={aiLoading || regeneratingTab === "vision_estrategica"}
                  className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  title="Generar Visión Estratégica basada en el informe completo"
                >
                  {regeneratingTab === "VISION_ESTRATEGICA" ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></span>
                      Generando...
                    </>
                  ) : (
                    <>Generar Visión Estratégica</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* ETAPA 2 — Informes (vista) */}
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">ETAPA 2 — Informes</div>
            <div className="flex flex-wrap gap-2">
              {canUseCommercial && report.trim() && (
                <button
                  type="button"
                  onClick={() => { setReportProfile("comercial"); const firstModuleId = getReportProfile("comercial").moduleIds[0]; const firstTab = TABS_CONFIG.find((t) => t.tabId === firstModuleId); setActiveReportTab(firstTab?.id ?? TABS_CONFIG[0].id); }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium bg-slate-50 text-slate-700 hover:bg-slate-100"
                  title="Ver informe comercial"
                >
                  Informe Comercial
                </button>
              )}
              {report.trim() && (reportTabs["vision_estrategica"]?.trim() ?? "").length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveReportTab("vision_estrategica")}
                  className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                  title="Ver Visión Estratégica"
                >
                  Informe Visión Estratégica
                </button>
              )}
            </div>
          </div>

          {/* ETAPA 3 — Exportación (PDF + Gamma) */}
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">ETAPA 3 — Exportación</div>
            <div className="flex flex-wrap gap-2">
              {canUseCommercial && (
                <button
                  type="button"
                  onClick={() => handleExportPdf("comercial")}
                  disabled={!leadId || aiLoading}
                  className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  title="Descargar PDF Informe Comercial"
                >
                  PDF Informe Comercial
                </button>
              )}
              {canUseTechnical && (
                <button
                  type="button"
                  onClick={() => handleExportPdf("tecnico")}
                  disabled={!leadId || aiLoading}
                  className="rounded-xl px-4 py-2 text-sm font-medium bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50"
                  title="Descargar PDF Informe Técnico"
                >
                  PDF Informe Técnico
                </button>
              )}
              {report.trim() && (reportTabs["vision_estrategica"]?.trim() ?? "").length > 0 && (
                <button
                  type="button"
                  onClick={handleExportPdfVision}
                  disabled={!leadId || aiLoading}
                  className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  title="Descargar PDF Visión Estratégica"
                >
                  PDF Visión Estratégica
                </button>
              )}
              {canUseCommercial && (
                <button
                  type="button"
                  onClick={() => fetchGammaPrompt("comercial")}
                  disabled={!leadId || gammaPromptLoading}
                  className="rounded-xl border border-violet-200 px-3 py-2 text-sm font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                  title="Editar prompt para Gamma (presentación comercial)"
                >
                  {gammaPromptLoading ? "..." : "Editar Prompt Gamma Comercial"}
                </button>
              )}
              {canUseTechnical && (
                <button
                  type="button"
                  onClick={() => fetchGammaPrompt("tecnico")}
                  disabled={!leadId || gammaPromptLoading}
                  className="rounded-xl border border-violet-200 px-3 py-2 text-sm font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                  title="Editar prompt para Gamma (presentación técnica)"
                >
                  {gammaPromptLoading ? "..." : "Editar Prompt Gamma Técnico"}
                </button>
              )}
              {canUseCommercial && (
                <button
                  type="button"
                  onClick={() => generateGammaProposal("comercial")}
                  disabled={!leadId || gammaLoading}
                  className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  title="Crear propuesta en Gamma desde plantilla comercial"
                >
                  {gammaLoading ? "Generando…" : "Generar Gamma Comercial"}
                </button>
              )}
              {canUseTechnical && (
                <button
                  type="button"
                  onClick={() => generateGammaProposal("tecnico")}
                  disabled={!leadId || gammaLoading}
                  className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  title="Crear propuesta en Gamma desde plantilla técnica"
                >
                  {gammaLoading ? "Generando…" : "Generar Gamma Técnico"}
                </button>
              )}
            </div>
          </div>

          {/* ETAPA 4 — Utilidades */}
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">ETAPA 4 — Utilidades</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copy}
                disabled={!report.trim()}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                title="Copiar al portapapeles"
              >
                Copiar
              </button>
              {report.trim() && (
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "rendered" ? "raw" : "rendered")}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  title={viewMode === "rendered" ? "Ver texto crudo" : "Ver vista renderizada"}
                >
                  {viewMode === "rendered" ? "Ver Texto" : "Vista"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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

      {gammaLoading && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Generando propuesta en Gamma…
        </div>
      )}
      {gammaGenerationId && !gammaUrl && !gammaPdfUrl && (
        <div className="mt-2 text-xs text-slate-500">
          ID de generación: {gammaGenerationId}
        </div>
      )}
      {(gammaPdfUrl || gammaUrl) && !gammaLoading && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-3 flex-wrap">
          {gammaPdfUrl ? (
            <>
              <span>PDF Gamma listo</span>
              <a
                href={gammaPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                download="informe-gamma.pdf"
                className="font-medium underline hover:no-underline"
              >
                Descargar PDF Gamma
              </a>
              {gammaUrl && (
                <a
                  href={gammaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:no-underline opacity-80"
                >
                  Abrir en Gamma
                </a>
              )}
            </>
          ) : (
            <>
              <span>Gamma lista</span>
              <a
                href={gammaUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline hover:no-underline"
              >
                Abrir Gamma
              </a>
            </>
          )}
        </div>
      )}
      {gammaError && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {gammaError}
        </div>
      )}

      {/* Campo de personalización IA */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="ai-prompt-extra" className="block text-xs font-medium text-slate-700">
            Personalización IA (opcional)
          </label>
          {savingPrompt && (
            <span className="text-xs text-slate-400">Guardando…</span>
          )}
        </div>
        <textarea
          id="ai-prompt-extra"
          value={aiPromptExtra}
          onChange={(e) => setAiPromptExtra(e.target.value)}
          disabled={aiLoading}
          placeholder="Ejemplo: Enfocarse en oportunidades de membresía premium y eventos corporativos. Priorizar empresas del sector tecnológico."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 resize-y min-h-[80px] disabled:opacity-50 disabled:cursor-not-allowed"
          rows={3}
        />
        <p className="mt-1 text-xs text-slate-500">
          Agrega instrucciones específicas para personalizar el análisis. Este texto se incluirá en el prompt de IA. Se guarda automáticamente.
        </p>
      </div>

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
                {/* Tabs del informe - barra de módulos (anchor para scroll) */}
                <div ref={tabsBarRef} className="mb-4 flex flex-wrap gap-2">
                  {visibleTabs.map((tab) => {
                    const hasMissingData = missingDataByTab[tab.tabId]?.faltantes.length > 0;
                    const st = moduleStatus[tab.tabId] ?? "idle";
                    const chipClass =
                      st === "done"
                        ? "bg-green-100 text-green-800 border-green-300"
                        : st === "running"
                          ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                          : st === "error"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : activeReportTab === tab.id
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";
                    return (
                      <div key={tab.id} ref={(el) => { moduleRefs.current[tab.id] = el; }}>
                        <button
                          type="button"
                          onClick={() => setActiveReportTab(tab.id)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${chipClass}`}
                        >
                          {tab.label}
                          {hasMissingData && (
                            <span className="text-amber-500" title="Faltan datos para mejorar precisión">
                              ⚠️
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Contenido del tab activo */}
                <div ref={modulePanelRef} className="rounded-xl border bg-white p-6">
                  {/* Título del módulo: barra negra estilo consultoría premium */}
                  <div className="bg-black text-white font-semibold text-[15px] px-3 py-2 rounded-md mb-3">
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
