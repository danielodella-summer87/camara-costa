import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env de Supabase");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function allowDevOrRequire(req: NextRequest, perm: string) {
  if (process.env.NODE_ENV !== "production") return { id: "dev" };
  return await requirePermission(req, perm);
}

export async function POST(req: NextRequest) {
  const user = await allowDevOrRequire(req, "config.update");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    profile_id?: string;
    items?: Array<{ id?: string; execution_order?: number }>;
  };
  const profile_id = typeof body.profile_id === "string" ? body.profile_id.trim() : "";
  const items = Array.isArray(body.items) ? body.items : [];
  if (!profile_id) {
    return NextResponse.json({ error: "profile_id requerido" }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ ok: true, data: { updated: 0 } }, { status: 200 });
  }

  const sb = supabaseAdmin();

  for (const item of items) {
    const rowId = typeof item.id === "string" ? item.id.trim() : "";
    const order = Number(item.execution_order);
    if (!rowId || !Number.isFinite(order)) {
      return NextResponse.json({ error: "Cada ítem requiere id y execution_order numérico" }, { status: 400 });
    }
    const { data: row, error: selErr } = await sb
      .from("ai_profile_prompts")
      .select("id,profile_id")
      .eq("id", rowId)
      .maybeSingle();
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
    if (!row || row.profile_id !== profile_id) {
      return NextResponse.json({ error: "Fila de enlace inválida o no pertenece al perfil" }, { status: 400 });
    }
  }

  const updates = await Promise.all(
    items.map(async (item) => {
      const rowId = String(item.id).trim();
      const order = Number(item.execution_order);
      return sb
        .from("ai_profile_prompts")
        .update({ execution_order: order })
        .eq("id", rowId)
        .eq("profile_id", profile_id);
    })
  );

  const firstErr = updates.find((u) => u.error)?.error;
  if (firstErr) {
    return NextResponse.json({ error: firstErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { updated: items.length } }, { status: 200 });
}
