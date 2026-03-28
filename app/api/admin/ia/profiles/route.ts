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
    .from("ai_analysis_profiles")
    .select("id,name,description,target_client_type,target_industries,base_instructions,cierre_oferta_principal,tipo_organizacion_vendedora,is_active,created_at,updated_at")
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const user = await allowDevOrRequire(req, "config.update");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name es obligatorio" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_analysis_profiles")
    .insert({
      name,
      description: typeof body?.description === "string" ? body.description.trim() : null,
      target_client_type: typeof body?.target_client_type === "string" ? body.target_client_type.trim() : null,
      target_industries: Array.isArray(body?.target_industries) ? body.target_industries.map(String) : [],
      base_instructions: typeof body?.base_instructions === "string" ? body.base_instructions : "",
      cierre_oferta_principal:
        typeof body?.cierre_oferta_principal === "string" ? body.cierre_oferta_principal.trim() : null,
      tipo_organizacion_vendedora:
        typeof body?.tipo_organizacion_vendedora === "string" ? body.tipo_organizacion_vendedora.trim() : null,
      is_active: typeof body?.is_active === "boolean" ? body.is_active : true,
    })
    .select("id,name,description,target_client_type,target_industries,base_instructions,cierre_oferta_principal,tipo_organizacion_vendedora,is_active,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
