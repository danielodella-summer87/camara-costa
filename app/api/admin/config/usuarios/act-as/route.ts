import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

// Dev: permitido. Prod: requiere permiso
async function allowDevOrRequire(req: NextRequest, perm: string) {
  if (process.env.NODE_ENV !== "production") return { id: "dev" };
  return await requirePermission(req, perm);
}

/**
 * POST /api/admin/config/usuarios/act-as
 * Body: { user_id: string | null }
 * - user_id válido => setea cookie x-user-id
 * - user_id null => borra cookie (vuelve a fallback admin)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await allowDevOrRequire(req, "config.admin");
    if (!user) {
      return NextResponse.json({ data: null, error: "No autorizado" } satisfies ApiResp<null>, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const user_id = (body?.user_id ?? null) as string | null;

    // limpiar cookie
    if (!user_id) {
      const res = NextResponse.json({ data: { ok: true, cleared: true }, error: null } satisfies ApiResp<any>, {
        status: 200,
      });
      res.cookies.set("x-user-id", "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
      return res;
    }

    // validar usuario destino
    const sb = supabaseAdmin();
    const { data: target, error } = await sb
      .from("app_users")
      .select("id,nombre,is_active,role_id,roles:role_id(id,name,label)")
      .eq("id", user_id)
      .maybeSingle();

    if (error) throw error;
    if (!target) {
      return NextResponse.json({ data: null, error: "user_id no existe" } satisfies ApiResp<null>, { status: 400 });
    }
    if (!target.is_active) {
      return NextResponse.json({ data: null, error: "Usuario inactivo" } satisfies ApiResp<null>, { status: 400 });
    }

    const res = NextResponse.json(
      { data: { ok: true, active_user: target }, error: null } satisfies ApiResp<any>,
      { status: 200 }
    );

    res.cookies.set("x-user-id", target.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}