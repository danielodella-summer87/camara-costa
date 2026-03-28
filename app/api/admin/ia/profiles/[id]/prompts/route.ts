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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await allowDevOrRequire(req, "config.read");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_profile_prompts")
    .select("id,profile_id,prompt_id,enabled_by_default,execution_order,created_at")
    .eq("profile_id", id)
    .order("execution_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await allowDevOrRequire(req, "config.update");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  const normalized = rows
    .filter((r: any) => r && typeof r.prompt_id === "string")
    .map((r: any, i: number) => ({
      profile_id: id,
      prompt_id: String(r.prompt_id),
      enabled_by_default: r.enabled_by_default !== false,
      execution_order: Number.isFinite(Number(r.execution_order)) ? Number(r.execution_order) : (i + 1) * 10,
    }));

  const sb = supabaseAdmin();
  const del = await sb.from("ai_profile_prompts").delete().eq("profile_id", id);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  if (normalized.length > 0) {
    const ins = await sb
      .from("ai_profile_prompts")
      .insert(normalized)
      .select("id,profile_id,prompt_id,enabled_by_default,execution_order,created_at");
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    return NextResponse.json({ data: ins.data ?? [] }, { status: 200 });
  }
  return NextResponse.json({ data: [] }, { status: 200 });
}
