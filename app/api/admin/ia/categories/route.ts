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
    .from("ai_categories")
    .select("id,name,description,is_active,created_at")
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const user = await allowDevOrRequire(req, "config.update");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  if (!name) return NextResponse.json({ error: "name es obligatorio" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_categories")
    .insert({ name, description, is_active })
    .select("id,name,description,is_active,created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
