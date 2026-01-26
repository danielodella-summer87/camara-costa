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
 * Extrae una sección específica del informe markdown por título
 */
function extractSection(report: string, section: string): string {
  if (!report || !report.trim()) return "";
  
  // Mapeo de tabs a patrones de búsqueda (case-insensitive)
  const sectionPatterns: Record<string, RegExp[]> = {
    foda: [
      /^##\s+FODA\s+/mi,
      /^##\s+\d+[\.\)]\s*FODA\s+/mi,
      /^##\s+FODA\s+como/mi,
    ],
    oportunidades: [
      /^##\s+OPORTUNIDADES\s+/mi,
      /^##\s+\d+[\.\)]\s*OPORTUNIDADES\s+/mi,
      /^##\s+Oportunidades\s+priorizadas/mi,
    ],
    acciones: [
      /^##\s+ACCIONES\s+/mi,
      /^##\s+\d+[\.\)]\s*ACCIONES\s+/mi,
      /^##\s+Plan\s+de\s+acci[oó]n/mi,
      /^##\s+Acciones\s+en\s+72\s+horas/mi,
    ],
    materiales: [
      /^##\s+MATERIALES\s+LISTOS\s+/mi,
      /^##\s+MATERIALES\s+/mi,
      /^##\s+Recursos\s+/mi,
      /^##\s+Copys\s+/mi,
      /^##\s+Scripts\s+/mi,
    ],
    siguientes: [
      /^##\s+SIGUIENTES\s+PASOS\s+/mi,
      /^##\s+Siguientes\s+pasos\s+/mi,
      /^##\s+Pr[oó]ximos\s+pasos\s+/mi,
      /^##\s+Recomendaci[oó]n\s+/mi,
    ],
  };
  
  const patterns = sectionPatterns[section] || [];
  if (patterns.length === 0) return "";
  
  // Buscar el patrón que coincida
  let match: RegExpMatchArray | null = null;
  let matchedPattern: RegExp | null = null;
  
  for (const pattern of patterns) {
    match = report.match(pattern);
    if (match) {
      matchedPattern = pattern;
      break;
    }
  }
  
  if (!match || !matchedPattern) return ""; // No se encontró la sección
  
  const startIdx = match.index!;
  
  // Buscar el siguiente título de nivel 2 (##) o el final del documento
  const remaining = report.slice(startIdx);
  const nextSectionMatch = remaining.match(/\n##\s+/);
  
  if (nextSectionMatch && nextSectionMatch.index !== null) {
    return remaining.slice(0, nextSectionMatch.index).trim();
  }
  
  // Si no hay siguiente sección, devolver hasta el final
  return remaining.trim();
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
  const [activeReportTab, setActiveReportTab] = useState<"foda" | "oportunidades" | "acciones" | "materiales" | "siguientes">("foda");
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

  async function generate(regenerate: boolean = false) {
    // Log solo valores primitivos
    console.log("generate() - leadId:", leadId?.trim() || "(vacío)", "canRun:", canRun, "regenerate:", regenerate);
    if (!canRun) return;
    setError(null);
    setLoading(true);
    setStatus("idle");
    try {
      // Guardar el lead antes de generar el informe
      // Si el guardado falla, el error se propaga y NO se llama a la IA
      if (onBeforeGenerate) {
        setStatus("saving");
        await onBeforeGenerate();
      }

      setStatus("generating");
      
      // Validar leadId antes de hacer el fetch
      const validLeadId = leadId?.trim();
      if (!validLeadId) {
        throw new Error("Lead ID inválido o faltante");
      }
      
      // Crear body con solo strings/boolean (sin objetos raros)
      const customPromptValue = aiPromptExtra?.trim() ? aiPromptExtra.trim() : null;
      const body: {
        custom_prompt: string | null;
        force_regenerate: boolean;
      } = {
        custom_prompt: customPromptValue,
        force_regenerate: regenerate,
      };
      
      // Log para debugging (solo valores primitivos)
      console.log("AI REPORT leadId=", validLeadId, "custom_prompt_len=", customPromptValue?.length ?? 0, "force=", regenerate);
      
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(validLeadId)}/ai-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => ({}))) as AiResp;
      if (!res.ok) throw new Error(json?.error ?? "No se pudo generar el informe IA.");

      const next = json?.data?.report ?? "";
      if (!next.trim()) throw new Error("La API devolvió un informe vacío.");

      setReport(next);
      setStatus("done");
      setReportExpanded(true); // Auto-expandir cuando se genera nuevo informe
    } catch (e: any) {
      // Si el error viene del guardado, mostrar mensaje específico
      const errorMsg = e?.message ?? "Error generando informe IA";
      setError(errorMsg);
      setStatus("idle");
    } finally {
      setLoading(false);
    }
  }

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
            onClick={(e) => {
              e?.preventDefault?.();
              generate(false); // false = no regenerar
            }}
            disabled={!canRun || loading}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            title={!canRun ? "Lead ID inválido" : "Generar informe"}
          >
            {loading ? "Generando…" : "Generar IA"}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e?.preventDefault?.();
              const ok = window.confirm(
                "Esto regenerará el informe IA y reemplazará el actual. ¿Deseas continuar?"
              );
              if (!ok) return;
              generate(true); // true = regenerate
            }}
            disabled={!canRun || loading}
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
                {/* Tabs del informe */}
                <div className="mb-4 inline-flex overflow-hidden rounded-xl border bg-white">
                  <button
                    type="button"
                    onClick={() => setActiveReportTab("foda")}
                    className={`px-4 py-2 text-sm font-semibold transition ${
                      activeReportTab === "foda"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    FODA
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveReportTab("oportunidades")}
                    className={`px-4 py-2 text-sm font-semibold transition ${
                      activeReportTab === "oportunidades"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Oportunidades
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveReportTab("acciones")}
                    className={`px-4 py-2 text-sm font-semibold transition ${
                      activeReportTab === "acciones"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Acciones
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveReportTab("materiales")}
                    className={`px-4 py-2 text-sm font-semibold transition ${
                      activeReportTab === "materiales"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Materiales Listos
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveReportTab("siguientes")}
                    className={`px-4 py-2 text-sm font-semibold transition ${
                      activeReportTab === "siguientes"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Siguientes Pasos
                  </button>
                </div>

                {/* Contenido del tab activo */}
                <div className="rounded-xl border bg-white p-6">
                  {viewMode === "raw" ? (
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono">
                      {extractSection(report, activeReportTab) || "No hay contenido para esta sección."}
                    </pre>
                  ) : (
                    <div className="prose max-w-none">
                      {extractSection(report, activeReportTab) ? (
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
                          {extractSection(report, activeReportTab)}
                        </ReactMarkdown>
                      ) : (
                        <div className="text-slate-500 italic">
                          No hay contenido para esta sección en el informe.
                        </div>
                      )}
                    </div>
                  )}
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
