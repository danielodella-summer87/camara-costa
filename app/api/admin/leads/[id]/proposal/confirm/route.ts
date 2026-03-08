import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateLeadSafe } from "@/lib/leads/updateLeadSafe";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

type DraftMonth = { key: string; label?: string };
type DraftRow = { proposalId: string; serviceId: string; valuesByMonth: Record<string, number | ""> };
type DraftPayload = { months?: DraftMonth[]; rows?: DraftRow[] };

function isValidDraft(draft: unknown): draft is DraftPayload {
  if (!draft || typeof draft !== "object") return false;
  const d = draft as Record<string, unknown>;
  if (!Array.isArray(d.months) || !Array.isArray(d.rows)) return false;
  for (const m of d.months) {
    if (!m || typeof m !== "object" || typeof (m as DraftMonth).key !== "string") return false;
  }
  for (const r of d.rows) {
    if (!r || typeof r !== "object" || typeof (r as DraftRow).proposalId !== "string" || typeof (r as DraftRow).serviceId !== "string") return false;
    if (typeof (r as DraftRow).valuesByMonth !== "object" || (r as DraftRow).valuesByMonth === null) return false;
  }
  return true;
}

/**
 * POST /api/admin/leads/[id]/proposal/confirm
 * Confirma la estructura de propuesta: valida el draft y marca proposal_confirmed_at.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: leadId } = await context.params;
    const id = safeStr(leadId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({})) as { draft?: unknown };
    if (!isValidDraft(body.draft)) {
      return NextResponse.json({ ok: false, error: "draft inválido: se espera { months: [], rows: [] }" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const now = new Date().toISOString();

    const updateResult = await updateLeadSafe(sb, id, {
      proposal_draft_json: JSON.stringify(body.draft),
      proposal_confirmed_at: now,
    }, { force_unlink_entity: false });

    if (updateResult.error) {
      return NextResponse.json({ ok: false, error: updateResult.error?.message ?? "Error al confirmar" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, proposal_confirmed_at: now });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
