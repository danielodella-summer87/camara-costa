import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function isUuidLike(v: unknown) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function wrapLines(text: string, maxChars = 95) {
  const lines: string[] = [];
  const raw = text.replace(/\r\n/g, "\n").split("\n");

  for (const l of raw) {
    const s = l ?? "";
    if (s.length <= maxChars) {
      lines.push(s);
      continue;
    }
    let cur = s;
    while (cur.length > maxChars) {
      const slice = cur.slice(0, maxChars);
      const cut = slice.lastIndexOf(" ");
      const idx = cut > 40 ? cut : maxChars;
      lines.push(cur.slice(0, idx));
      cur = cur.slice(idx).trimStart();
    }
    if (cur.length) lines.push(cur);
  }
  return lines;
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const id = ctx?.params?.id;
    if (!id || !isUuidLike(id)) {
      return NextResponse.json({ data: null, error: "id inválido" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id,nombre,ai_report,ai_report_updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    if (!lead) return NextResponse.json({ data: null, error: "No existe lead" }, { status: 404 });

    const report = (lead as any).ai_report as string | null;
    if (!report || !report.trim()) {
      return NextResponse.json(
        { data: null, error: "Este lead todavía no tiene informe IA" },
        { status: 400 }
      );
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const margin = 48;
    let y = 841.89 - margin;

    const title = `Informe IA — ${(lead as any).nombre ?? "Lead"}`;
    page.drawText(title, {
      x: margin,
      y,
      size: 16,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 26;

    const meta = `Actualizado: ${(lead as any).ai_report_updated_at ?? "—"} · Lead ID: ${id}`;
    page.drawText(meta, {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 18;

    const lines = wrapLines(report, 95);
    const fontSize = 10.5;
    const lineH = 14;

    for (const line of lines) {
      if (y < margin + 40) {
        // nueva página
        const p2 = pdfDoc.addPage([595.28, 841.89]);
        y = 841.89 - margin;
        // seguimos escribiendo en la nueva página
        (page as any) = p2;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.12, 0.12, 0.12),
      });
      y -= lineH;
    }

    const bytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="informe_ia_${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error inesperado" }, { status: 500 });
  }
}