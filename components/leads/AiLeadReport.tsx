"use client";

import { useMemo, useState } from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";

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
}: {
  leadId: string;
  lead?: LeadMini | null;
}) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const canRun = !!leadId;

  const filename = useMemo(() => {
    const base = (lead?.nombre || "lead").toString().trim().replace(/[^\w\-]+/g, "_");
    const stamp = new Date().toISOString().slice(0, 10);
    return `AI_Informe_${base}_${stamp}.pdf`;
  }, [lead?.nombre]);

  async function generate() {
    if (!canRun) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/ai-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
      });

      const json = (await res.json().catch(() => ({}))) as AiResp;
      if (!res.ok) throw new Error(json?.error ?? "No se pudo generar el informe IA.");

      const next = json?.data?.report ?? "";
      if (!next.trim()) throw new Error("La API devolvió un informe vacío.");

      setReport(next);
    } catch (e: any) {
      setError(e?.message ?? "Error generando informe IA");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!report.trim()) return;

    const title = `Informe IA · ${lead?.nombre ?? "Lead"}`;
    const bytes = await textToPdfBytes(title, report);
    const blob = new Blob([bytes], { type: "application/pdf" });
    downloadBlob(blob, filename);
  }

  async function copy() {
    if (!report.trim()) return;
    await navigator.clipboard.writeText(report);
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Agente IA · Informe del Lead</div>
          <div className="mt-1 text-xs text-slate-500">
            Genera FODA + oportunidades para la cámara + acciones sugeridas. (Demo por ahora)
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
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4">
        {!report.trim() ? (
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
            Aún no hay informe. Tocá <span className="font-semibold">Generar IA</span>.
          </div>
        ) : (
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
            {report}
          </div>
        )}
      </div>
    </div>
  );
}