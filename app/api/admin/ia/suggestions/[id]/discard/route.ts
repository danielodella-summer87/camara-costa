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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await allowDevOrRequire(req, "config.update");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const sb = supabaseAdmin();
  const { data: suggestion, error: sErr } = await sb
    .from("ai_prompt_suggestions")
    .select("id,status")
    .eq("id", id)
    .single();
  if (sErr || !suggestion) return NextResponse.json({ error: sErr?.message ?? "Sugerencia no encontrada" }, { status: 404 });
  if (suggestion.status !== "pending") return NextResponse.json({ error: "La sugerencia no está pendiente" }, { status: 400 });

  const { error: uErr } = await sb
    .from("ai_prompt_suggestions")
    .update({ status: "discarded", discarded_at: new Date().toISOString() })
    .eq("id", id);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 200 });
}

