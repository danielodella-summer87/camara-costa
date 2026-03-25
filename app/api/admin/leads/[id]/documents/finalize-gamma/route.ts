import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { finalizeGammaLeadDocument } from "@/lib/documents/finalizeGammaLeadDocument";
import type { LeadDocumentType } from "@/lib/leads/leadDocuments";

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
 * POST: tras generación Gamma, reconsulta la API (con espera de export), archiva PDF en `documents`
 * o persiste pending con enlace web si no hay PDF.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: leadId } = await params;
    if (!leadId?.trim() || !isUuidLike(leadId)) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const generationId = typeof body?.generationId === "string" ? body.generationId.trim() : "";
    const type = (body?.type as string | undefined) ?? "presentation";
    if (!generationId) {
      return NextResponse.json({ ok: false, error: "generationId es requerido" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type as LeadDocumentType)) {
      return NextResponse.json(
        { ok: false, error: "type debe ser diagnostic, strategy, proposal o presentation" },
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();
    const result = await finalizeGammaLeadDocument({
      sb,
      leadId: leadId.trim(),
      type: type as LeadDocumentType,
      generationId,
      maxWaitAfterCompletedMs: 90_000,
    });

    if (!result.ok) {
      const status = result.suggestRegenerate ? 502 : 500;
      return NextResponse.json(
        { ok: false, error: result.error, suggestRegenerate: result.suggestRegenerate },
        { status }
      );
    }

    if (result.kind === "archived") {
      return NextResponse.json({
        ok: true,
        kind: "archived",
        publicUrl: result.publicUrl,
        type,
      });
    }

    return NextResponse.json({
      ok: true,
      kind: "pending_gamma_web",
      message: result.message,
      type,
    });
  } catch (e) {
    console.error("[finalize-gamma]", e);
    return NextResponse.json({ ok: false, error: "Error al finalizar documento Gamma." }, { status: 500 });
  }
}
