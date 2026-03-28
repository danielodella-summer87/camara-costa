import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { updateLeadSafe } from "@/lib/leads/updateLeadSafe";
import type { CommercialStrategyStored } from "@/lib/crm/commercialStrategyTypes";
import { COMMERCIAL_STRATEGY_FIELD_KEYS } from "@/lib/crm/commercialStrategyTypes";

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

function normalizeStored(body: unknown): CommercialStrategyStored | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const gen = (b.generated && typeof b.generated === "object" ? b.generated : {}) as Record<string, string>;
  const ed = (b.edited && typeof b.edited === "object" ? b.edited : {}) as Record<string, string>;
  const ui = (b.userInputs && typeof b.userInputs === "object" ? b.userInputs : {}) as CommercialStrategyStored["userInputs"];
  const out: CommercialStrategyStored = { generated: {}, edited: {}, userInputs: { ...ui } };
  for (const k of COMMERCIAL_STRATEGY_FIELD_KEYS) {
    if (typeof gen[k] === "string") out.generated[k] = gen[k];
    if (typeof ed[k] === "string") out.edited[k] = ed[k];
  }
  return out;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const body = (await req.json().catch(() => ({}))) as { strategy?: unknown };
    const stored = normalizeStored(body.strategy);
    if (!stored) {
      return NextResponse.json({ ok: false, error: "strategy inválido" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const updateResult = await updateLeadSafe(
      sb,
      id,
      {
        commercial_strategy_json: stored,
        strategy_approved_at: null,
      },
      { force_unlink_entity: false }
    );

    if (updateResult.error) {
      return NextResponse.json(
        { ok: false, error: updateResult.error?.message ?? "Error al guardar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, strategy: stored });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
