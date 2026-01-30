import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Buffer } from "node:buffer";
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
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

function wrapText(text: string, maxChars = 90) {
  const lines: string[] = [];
  const paragraphs = String(text ?? "").replace(/\r\n/g, "\n").split("\n");

  for (const p of paragraphs) {
    const words = p.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`;
      if (next.length > maxChars) {
        lines.push(line);
        line = words[i];
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sb = supabaseAdmin();
    const { id } = await params;

    if (!id) {
      return new Response(JSON.stringify({ data: null, error: "id requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: lead, error } = await sb
      .from("leads")
      .select("id,nombre,ai_report,ai_report_updated_at")
      .eq("id", id)
      .single();

    if (error) throw error;

    const title = (lead?.nombre && String(lead.nombre)) || `Lead ${id}`;
    const report = (lead?.ai_report && String(lead.ai_report)) || "Sin informe IA todavía.";
    const updatedAt = lead?.ai_report_updated_at ? String(lead.ai_report_updated_at) : null;

    // Sanitizar textos antes de procesar
    const sanitizedTitle = sanitizeForPdf(title);
    const sanitizedReport = sanitizeForPdf(report);
    const sanitizedUpdatedAt = updatedAt ? sanitizeForPdf(updatedAt) : null;

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([595.28, 841.89]); // A4
    const margin = 48;
    let y = 841.89 - margin;

    const drawLine = (txt: string, size = 11, bold = false) => {
      const f = bold ? fontBold : font;
      page.drawText(sanitizeForPdf(txt), { x: margin, y, size, font: f });
      y -= size + 6;
    };

    drawLine("AI Lead Report", 18, true);
    drawLine(sanitizedTitle, 12, true);
    if (sanitizedUpdatedAt) drawLine(`Actualizado: ${sanitizedUpdatedAt}`, 10, false);
    y -= 6;

    const lines = wrapText(sanitizedReport, 95);
    for (const ln of lines) {
      // salto de página si falta espacio
      if (y < margin + 24) {
        page = pdf.addPage([595.28, 841.89]);
        y = 841.89 - margin;
      }
      drawLine(ln, 11, false);
    }

    const bytes = await pdf.save();

    // ✅ convertir a Buffer para que TS lo acepte como BodyInit en runtime node
    const body = Buffer.from(bytes);
    
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // dejá el resto de headers tal cual los tenías
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ data: null, error: e?.message ?? "Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}