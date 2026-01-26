"use client";

import { useMemo, useState, useEffect, useRef } from "react";
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
] as const;

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

  // Extraer sección FALTANTES
  const faltantesMatch = content.match(/###\s+FALTANTES\s*\n([\s\S]*?)(?=###|$)/i);
  if (faltantesMatch) {
    const faltantesText = faltantesMatch[1].trim();
    // Extraer líneas que empiezan con - o *
    const lines = faltantesText.split("\n").filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith("-") || trimmed.startsWith("*");
    });
    faltantes.push(...lines.map(line => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean));
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
    preguntas.push(...lines.map(line => line.replace(/^\d+[).]\s*/, "").replace(/^[-*]\s*/, "").trim()).filter(Boolean));
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
    dondeCargar.push(...lines.map(line => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean));
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

/**
 * Parsea el informe completo y extrae todas las secciones por TAB
 * Formato esperado: ### TAB:<ID>
 * Retorna un objeto { [tabId]: contenido }
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
    const tabId = match[1];
    const startIndex = match.index + match[0].length;
    
    // Buscar el siguiente ### TAB: o el final del documento
    const remaining = report.slice(startIndex);
    const nextTabMatch = remaining.match(/###\s*TAB:\S+/);

    const nextIndex =
      nextTabMatch && typeof nextTabMatch.index === "number"
        ? nextTabMatch.index
        : null;

    const endIndex = nextIndex !== null ? startIndex + nextIndex : report.length;
    
    matches.push({ tabId, startIndex, endIndex });
  }
  
  // Si no hay matches, intentar buscar al final del documento (último tab sin salto de línea)
  if (matches.length === 0) {
    const altPattern = /###\s+TAB:\s*(\w+)\s*$/gm;
    let altMatch;
    while ((altMatch = altPattern.exec(report)) !== null) {
      const tabId = altMatch[1];
      const startIndex = altMatch.index! + altMatch[0].length;
      matches.push({ tabId, startIndex, endIndex: report.length });
    }
  }
  
  // Extraer contenido para cada tab encontrado
  for (const { tabId, startIndex, endIndex } of matches) {
    const content = report.slice(startIndex, endIndex).trim();
    if (content) {
      tabs[tabId] = content;
    }
  }
  
  return tabs;
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
  page.drawText(title, { x: margin, y: y - titleSize, size: titleSize, font: fontBold });
  y -= 28;

  // Body
  const lines = wrap(content, bodySize);

  for (const ln of lines) {
    if (y < margin + 60) {
      const newPage = pdfDoc.addPage([595.28, 841.89]);
      y = newPage.getHeight() - margin;

      // pequeña marca de continuidad
      newPage.drawText(title, {
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

    (page as any).drawText(ln, {
      x: margin,
      y: y - bodySize,
      size: bodySize,
      font,
    });
    y -= lineHeight;
  }

  return await pdfDoc.save();
}

export function AiLeadReport({
  leadId,
  lead,
  onBeforeGenerate,
}: {
  leadId: string;
  lead?: LeadMini | null;
  onBeforeGenerate?: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [status, setStatus] = useState<"idle" | "saving" | "generating" | "done">("idle");
  const [aiPromptExtra, setAiPromptExtra] = useState<string>("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<string>(TABS_CONFIG[0].id);
  const [regeneratingTab, setRegeneratingTab] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [missingAnswersText, setMissingAnswersText] = useState<string>("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canRun = !!(leadId && leadId.trim());

  // Inicializar report desde el lead cuando se carga o cambia
  useEffect(() => {
    const initialReport = (lead as any)?.ai_report ?? "";
    if (initialReport && initialReport.trim()) {
      setReport(initialReport);
      setReportExpanded(true); // Auto-expandir cuando hay informe
    }
  }, [lead]);

  // Precargar el textarea desde lead.ai_custom_prompt
  useEffect(() => {
    const initialPrompt = lead?.ai_custom_prompt ?? "";
    setAiPromptExtra(initialPrompt);
  }, [lead?.ai_custom_prompt]);

  // Autosave con debounce (700ms)
  // Solo guarda cuando el usuario cambia el valor (no en el primer render)
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Saltar el primer render (cuando se precarga desde lead.ai_custom_prompt)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Limpiar timeout anterior si existe
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Si no hay leadId, no guardar
    if (!leadId?.trim()) return;

    // Crear nuevo timeout para guardar después del debounce
    saveTimeoutRef.current = setTimeout(async () => {
      const validLeadId = leadId.trim();
      const valueToSave = aiPromptExtra.trim() || null;

      try {
        setSavingPrompt(true);
        const res = await fetch(`/api/admin/leads/${encodeURIComponent(validLeadId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ai_custom_prompt: valueToSave }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          console.warn("Error guardando ai_custom_prompt:", json?.error);
          // No mostrar error al usuario para no romper UX
        }
      } catch (e: any) {
        console.warn("Error guardando ai_custom_prompt:", e?.message);
        // No mostrar error al usuario para no romper UX
      } finally {
        setSavingPrompt(false);
      }
    }, 700); // 700ms de debounce

    // Cleanup: limpiar timeout si el componente se desmonta o cambia el valor
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [aiPromptExtra, leadId]);

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

  // Derivar datos faltantes por tab
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

  // Función para regenerar un tab específico
  const regenerateTab = async (tabId: string) => {
    if (!leadId?.trim()) return;
    
    setRegeneratingTab(tabId);
    setError(null);
    setToastMessage("Regenerando…");
    
    try {
      // Leer prompts desde localStorage con metadata
      const promptsData = getAiPromptsFromLocalStorage();
      
      if (!promptsData) {
        throw new Error("No se encontraron prompts en localStorage");
      }

      // Incluir personalización IA en el body (siempre)
      const customPromptValue = aiPromptExtra?.trim() ? aiPromptExtra.trim() : null;
      
      // Construir body con estructura requerida
      const body: {
        custom_prompt: string | null;
        personalization?: string | null;
        force_regenerate: boolean;
        only_module: string;
        prompts: { base: string; modules: Record<string, string> };
        prompts_meta: { updated_at: { base?: number; modules?: Record<string, number> } };
      } = {
        custom_prompt: customPromptValue, // Personalización IA siempre incluida (backward compatibility)
        personalization: customPromptValue, // Nuevo campo explícito
        force_regenerate: true,
        only_module: tabId,
        prompts: {
          base: promptsData.prompts.base || "",
          modules: { [tabId]: promptsData.prompts.modules?.[tabId] || "" },
        },
        prompts_meta: promptsData.meta,
      };

      const res = await fetch(`/api/admin/leads/${leadId}/ai-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error regenerando módulo");
      }

      const data = await res.json();
      const updatedReport = data.data?.report ?? data.report ?? "";
      
      if (updatedReport) {
        setReport(updatedReport);
        setToastMessage("Actualizado ✅");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err: any) {
      console.error("[AI] ERROR regenerando módulo", err);
      setError(err?.message ?? "Error regenerando módulo. Ver consola.");
      setToastMessage(null);
    } finally {
      setRegeneratingTab(null);
    }
  };

  const generateAI = async () => {
    console.log("[AI] click generar");
    console.log("[AI] llamando endpoint");
    await handleGenerate(false);
  };

  const handleGenerate = async (force = false, moduleId?: string) => {
    console.log("[AI] CLICK Generar IA", { force, moduleId });

    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  async function downloadPdf() {
    if (!report.trim()) return;

    const title = `Informe IA · ${lead?.nombre ?? "Lead"}`;
    const bytes = await textToPdfBytes(title, report);
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    downloadBlob(blob, filename);
  }

  async function copy() {
    if (!report.trim()) return;
    await navigator.clipboard.writeText(report);
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      {status !== "idle" && (
        <div className="mb-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {status === "saving" && "Guardando datos del lead…"}
          {status === "generating" && "Generando informe con IA…"}
          {status === "done" && "Informe generado correctamente."}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Agente IA · Informe del Lead</div>
          <div className="mt-1 text-xs text-slate-500">
            Genera informe técnico de oportunidades con análisis estratégico.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => generateAI()}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Generando…" : "Generar IA"}
          </button>

          <button
            type="button"
            onClick={() => handleGenerate(true)}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Regenerar IA
          </button>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={!report.trim()}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            title="Descargar PDF"
          >
            PDF
          </button>

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
              {viewMode === "rendered" ? "Texto" : "Vista"}
            </button>
          )}
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
          disabled={loading}
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
                {/* Tabs del informe (11 módulos) - iterar sobre TABS_CONFIG */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {TABS_CONFIG.map((tab) => {
                    const hasMissingData = missingDataByTab[tab.tabId]?.faltantes.length > 0;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveReportTab(tab.id)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                          activeReportTab === tab.id
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {tab.label}
                        {hasMissingData && (
                          <span className="text-amber-500" title="Faltan datos para mejorar precisión">
                            ⚠️
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Contenido del tab activo */}
                <div className="rounded-xl border bg-white p-6">
                  {/* Header con botón regenerar y prompt preview */}
                  <div className="mb-4 space-y-3 border-b border-slate-200 pb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {TABS_CONFIG.find(t => t.id === activeReportTab)?.label || "Tab"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          const activeTabConfig = TABS_CONFIG.find(t => t.id === activeReportTab);
                          if (activeTabConfig) {
                            regenerateTab(activeTabConfig.tabId);
                          }
                        }}
                        disabled={regeneratingTab === TABS_CONFIG.find(t => t.id === activeReportTab)?.tabId}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {regeneratingTab === TABS_CONFIG.find(t => t.id === activeReportTab)?.tabId ? (
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></span>
                            Regenerando...
                          </span>
                        ) : (
                          "Regenerar este módulo"
                        )}
                      </button>
                    </div>
                    
                    {/* Prompt en uso */}
                    {(() => {
                      const activeTabConfig = TABS_CONFIG.find(t => t.id === activeReportTab);
                      if (!activeTabConfig) return null;
                      
                      const promptsData = getAiPromptsFromLocalStorage();
                      const modulePrompt = promptsData?.prompts.modules?.[activeTabConfig.tabId] || "";
                      const basePrompt = promptsData?.prompts.base || "";
                      
                      if (!modulePrompt && !basePrompt) return null;
                      
                      const previewLines = modulePrompt.split("\n").slice(0, 2).join("\n");
                      const fullPrompt = modulePrompt || basePrompt;
                      
                      return (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Prompt en uso</div>
                              {showPromptPreview ? (
                                <pre className="text-xs text-blue-800 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                                  {fullPrompt}
                                </pre>
                              ) : (
                                <div className="text-xs text-blue-700 line-clamp-2">
                                  {previewLines || "(Sin preview disponible)"}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowPromptPreview(!showPromptPreview)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                            >
                              {showPromptPreview ? "Ocultar" : "Ver completo"}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {(() => {
                    // Buscar el tab activo en TABS_CONFIG
                    const activeTabConfig = TABS_CONFIG.find(t => t.id === activeReportTab);
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
                                disabled={loading || regeneratingTab !== null}
                              />
                              <div className="mt-2 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const activeTabConfig = TABS_CONFIG.find(t => t.id === activeReportTab);
                                    if (activeTabConfig) {
                                      addMissingAnswersToPersonalization(activeTabConfig.tabId, activeTabConfig.label);
                                    }
                                  }}
                                  disabled={!missingAnswersText.trim() || loading || regeneratingTab !== null}
                                  className="rounded-lg border border-amber-600 bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Agregar a Personalización IA
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {hasContent && (
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
                            {sectionContent}
                          </ReactMarkdown>
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
    </div>
  );
}
