import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { updateLeadSafe } from "@/lib/leads/updateLeadSafe";
import { COMMERCIAL_STRATEGY_FIELD_KEYS } from "@/lib/crm/commercialStrategyTypes";
import { parseCommercialStrategyStored } from "@/lib/crm/commercialStrategyFlow";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function hasStrategyContent(stored: ReturnType<typeof parseCommercialStrategyStored>): boolean {
  if (!stored) return false;
  return COMMERCIAL_STRATEGY_FIELD_KEYS.some((k) => {
    const v = (stored.edited[k] ?? stored.generated[k] ?? "").trim();
    return v.length > 0;
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = safeId(rawId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .select("commercial_strategy_json")
      .eq("id", id)
      .maybeSingle();

    if (leadErr) throw leadErr;
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead no encontrado" }, { status: 404 });
    }

    const stored = parseCommercialStrategyStored(lead.commercial_strategy_json);
    if (!hasStrategyContent(stored)) {
      return NextResponse.json(
        { ok: false, error: "Generá o completá la estrategia antes de confirmar." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updateResult = await updateLeadSafe(
      sb,
      id,
      { strategy_approved_at: now },
      { force_unlink_entity: false }
    );

    if (updateResult.error) {
      return NextResponse.json(
        { ok: false, error: updateResult.error?.message ?? "Error al confirmar" },
        { status: 500 }
      );
    }

    const { data: row } = await sb
      .from("leads")
      .select("id,strategy_approved_at,commercial_strategy_json")
      .eq("id", id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      strategy_approved_at: row?.strategy_approved_at ?? now,
      lead: row
        ? {
            id: row.id,
            strategy_approved_at: row.strategy_approved_at,
            commercial_strategy_json: row.commercial_strategy_json,
          }
        : { id, strategy_approved_at: now },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
