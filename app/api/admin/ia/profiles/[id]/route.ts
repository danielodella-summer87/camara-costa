import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { getRoleNameByRoleId } from "@/lib/rbac/leadProfiles";

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await allowDevOrRequire(req, "config.update");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string") patch.name = body.name.trim();
  if (typeof body?.description === "string" || body?.description === null) patch.description = body.description;
  if (typeof body?.target_client_type === "string" || body?.target_client_type === null) patch.target_client_type = body.target_client_type;
  if (Array.isArray(body?.target_industries)) patch.target_industries = body.target_industries.map(String);
  if (typeof body?.base_instructions === "string") patch.base_instructions = body.base_instructions;
  if (typeof body?.cierre_oferta_principal === "string" || body?.cierre_oferta_principal === null) {
    patch.cierre_oferta_principal =
      typeof body.cierre_oferta_principal === "string" ? body.cierre_oferta_principal.trim() : null;
  }
  if (typeof body?.tipo_organizacion_vendedora === "string" || body?.tipo_organizacion_vendedora === null) {
    patch.tipo_organizacion_vendedora =
      typeof body.tipo_organizacion_vendedora === "string" ? body.tipo_organizacion_vendedora.trim() : null;
  }
  if (typeof body?.is_active === "boolean") patch.is_active = body.is_active;

  const sb = supabaseAdmin();
  if (typeof body?.is_active === "boolean") {
    const roleName = await getRoleNameByRoleId(sb, (user as any)?.role_id);
    const role = String(roleName || "").trim().toLowerCase();
    if (!(role === "admin" || role === "superadmin")) {
      return NextResponse.json({ error: "Solo administradores pueden cambiar el perfil activo" }, { status: 403 });
    }
  }

  const { data, error } = await sb
    .from("ai_analysis_profiles")
    .update(patch)
    .eq("id", id)
    .select("id,name,description,target_client_type,target_industries,base_instructions,cierre_oferta_principal,tipo_organizacion_vendedora,is_active,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 200 });
}
