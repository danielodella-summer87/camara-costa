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

/**
 * Helper: permite acceso en desarrollo, requiere permiso en producción
 */
async function allowDevOrRequire(req: NextRequest, perm: string) {
  if (process.env.NODE_ENV !== "production") return { id: "dev" };
  return await requirePermission(req, perm);
}

export async function GET(req: NextRequest) {
  try {
    const user = await allowDevOrRequire(req, "config.read");
    if (!user) {
      return NextResponse.json({ data: null, error: "No autorizado" } satisfies ApiResp<null>, { status: 403 });
    }

    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("app_users")
      .select("id,nombre,email,is_active,created_at,updated_at,role_id,roles:role_id(id,name,label)")
      .order("nombre", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data ?? [], error: null } satisfies ApiResp<any>, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}
