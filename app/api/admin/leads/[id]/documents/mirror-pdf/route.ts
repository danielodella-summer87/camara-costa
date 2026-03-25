import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { type LeadDocumentType } from "@/lib/leads/leadDocuments";
import { archiveGammaExportPdfToDocuments } from "@/lib/documents/archiveDocument";
import { isTransientGammaExportPdfUrl } from "@/lib/leads/presentationUtils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_TYPES: LeadDocumentType[] = ["diagnostic", "strategy", "proposal", "presentation"];

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function isUuidLike(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * POST: descarga un PDF desde la URL de export de Gamma, lo sube a Storage `documents`
 * y devuelve la URL pública. Opcionalmente persiste en lead_documents.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: leadId } = await params;
    if (!leadId?.trim()) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }
    if (!isUuidLike(leadId)) {
      return NextResponse.json({ ok: false, error: "id inválido (UUID)" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const sourceUrlRaw = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    const type = (body?.type as string | undefined) ?? "presentation";
    const generationId =
      typeof body?.generationId === "string" && body.generationId.trim().length > 0
        ? body.generationId.trim()
        : null;
    const persist = body?.persist !== false;

    if (!sourceUrlRaw) {
      return NextResponse.json({ ok: false, error: "Se requiere sourceUrl" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type as LeadDocumentType)) {
      return NextResponse.json(
        { ok: false, error: "type debe ser diagnostic, strategy, proposal o presentation" },
        { status: 400 }
      );
    }
    if (!isTransientGammaExportPdfUrl(sourceUrlRaw)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La URL no es un export PDF permitido de Gamma (solo enlaces https de assets.api.gamma.app/export/pdf/).",
        },
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();
    const result = await archiveGammaExportPdfToDocuments({
      sb,
      leadId: leadId.trim(),
      type: type as LeadDocumentType,
      sourceUrl: sourceUrlRaw,
      generationId,
      persist,
    });

    if (!result.ok) {
      const status = result.suggestRegenerate ? 502 : 500;
      return NextResponse.json({ ok: false, error: result.error, suggestRegenerate: result.suggestRegenerate }, { status });
    }

    return NextResponse.json({
      ok: true,
      publicUrl: result.publicUrl,
      path: result.storagePath,
      type,
    });
  } catch (e) {
    console.error("[mirror-pdf]", e);
    return NextResponse.json({ ok: false, error: "Error inesperado al archivar el PDF." }, { status: 500 });
  }
}
