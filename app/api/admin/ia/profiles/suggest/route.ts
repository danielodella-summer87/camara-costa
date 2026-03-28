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

function norm(v: string | null | undefined): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function GET(req: NextRequest) {
  const user = await allowDevOrRequire(req, "leads.read");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(req.url);
  const industry = norm(url.searchParams.get("industry"));
  const clientType = norm(url.searchParams.get("client_type"));

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_analysis_profiles")
    .select("id,name,target_client_type,target_industries,is_active")
    .eq("is_active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = Array.isArray(data) ? data : [];
  let best: any = null;
  let score = -1;
  for (const r of rows) {
    let s = 0;
    if (clientType && norm(r.target_client_type) === clientType) s += 2;
    const inds = Array.isArray(r.target_industries) ? r.target_industries.map(norm) : [];
    if (industry && inds.includes(industry)) s += 3;
    if (s > score) {
      score = s;
      best = r;
    }
  }
  return NextResponse.json({ data: best, score }, { status: 200 });
}
