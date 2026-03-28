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

export async function GET(req: NextRequest) {
  const user = await allowDevOrRequire(req, "config.read");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_prompt_suggestions")
    .select("prompt_id,status")
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: any) => {
    const id = String(row.prompt_id || "");
    if (!id) return;
    counts[id] = (counts[id] ?? 0) + 1;
  });

  return NextResponse.json({ data: counts }, { status: 200 });
}

