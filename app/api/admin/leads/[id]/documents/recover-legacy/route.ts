import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { recoverLegacyGammaDocumentsForLead } from "@/lib/leads/recoverLegacyGammaDocuments";
import type { LeadDocumentType } from "@/lib/leads/leadDocuments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALL_TYPES = ["diagnostic", "strategy", "proposal", "presentation"] as const satisfies readonly LeadDocumentType[];

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
 * POST: recuperación / migración lógica de documentos legacy con URL efímera Gamma → Storage propio.
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
    const rawTypes = Array.isArray(body?.types) ? body.types : null;
    const parsedTypes =
      rawTypes?.filter((t: unknown): t is LeadDocumentType => typeof t === "string" && (ALL_TYPES as readonly string[]).includes(t)) ??
      null;
    const typesOption = parsedTypes && parsedTypes.length > 0 ? { types: parsedTypes } : undefined;

    const sb = supabaseAdmin();
    const { leadId: lid, results, summary } = await recoverLegacyGammaDocumentsForLead(sb, leadId, typesOption);

    return NextResponse.json({
      ok: true,
      leadId: lid,
      results,
      summary,
    });
  } catch (e) {
    console.error("[recover-legacy]", e);
    return NextResponse.json({ ok: false, error: "Error inesperado en recuperación legacy." }, { status: 500 });
  }
}
