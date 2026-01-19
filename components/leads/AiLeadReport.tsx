"use client";

import { useMemo, useState, useEffect } from "react";
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

  const canRun = !!(leadId && leadId.trim());

  // Inicializar report desde el lead cuando se carga o cambia
  useEffect(() => {
    const initialReport = (lead as any)?.ai_report ?? "";
    if (initialReport && initialReport.trim()) {
      setReport(initialReport);
    }
  }, [lead]);

  const filename = useMemo(() => {
    const base = (lead?.nombre || "lead").toString().trim().replace(/[^\w\-]+/g, "_");
    const stamp = new Date().toISOString().slice(0, 10);
    return `AI_Informe_${base}_${stamp}.pdf`;
  }, [lead?.nombre]);

  async function generate() {
    console.log("generate() - leadId recibido:", leadId, "canRun:", canRun);
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
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId.trim())}/ai-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({
          extra_context: aiPromptExtra.trim() || null,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as AiResp;
      if (!res.ok) throw new Error(json?.error ?? "No se pudo generar el informe IA.");

      const next = json?.data?.report ?? "";
      if (!next.trim()) throw new Error("La API devolvió un informe vacío.");

      setReport(next);
      setStatus("done");
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
            onClick={generate}
            disabled={!canRun || loading}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            title={!canRun ? "Lead ID inválido" : "Generar informe"}
          >
            {loading ? "Generando…" : "Generar IA"}
          </button>

          <button
            type="button"
            onClick={async () => {
              const ok = window.confirm(
                "Esto regenerará el informe IA y reemplazará el actual. ¿Deseas continuar?"
              );
              if (!ok) return;
              await generate();
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
        <label htmlFor="ai-prompt-extra" className="block text-xs font-medium text-slate-700 mb-1">
          Personalización IA (opcional)
        </label>
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
          Agrega instrucciones específicas para personalizar el análisis. Este texto se incluirá en el prompt de IA.
        </p>
      </div>

      <div className="mt-4">
        {!report.trim() ? (
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
            Aún no hay informe. Tocá <span className="font-semibold">Generar IA</span>.
          </div>
        ) : viewMode === "raw" ? (
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap font-mono">
            {report}
          </div>
        ) : (
          <div className="rounded-xl border bg-white p-6 prose prose-slate max-w-none">
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
              {report}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
