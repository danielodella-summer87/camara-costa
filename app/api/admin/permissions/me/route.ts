import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { extractPermissionKeys } from "@/lib/rbac/extractPermissionKeys";

export const dynamic = "force-dynamic";

type ApiResp<T> = { data?: T | null; error?: string | null };

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function resolveActiveUserId(sb: ReturnType<typeof supabaseAdmin>) {
  // 1) Cookie de usuario activo
  const cookieStore = await cookies();
  const cookieUserId = cookieStore.get("x-user-id")?.value ?? null;
  if (cookieUserId) return cookieUserId;

  // 2) Fallback: primer usuario activo
  const { data: admin } = await sb
    .from("app_users")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return admin?.id ?? null;
}

/**
 * GET /api/admin/permissions/me
 * Devuelve lista de permission keys (strings) para el usuario activo
 */
export async function GET(req: NextRequest) {
  try {
    const sb = supabaseAdmin();

    const userId = await resolveActiveUserId(sb);
    if (!userId) {
      return NextResponse.json({ data: [], error: null } satisfies ApiResp<string[]>, { status: 200 });
    }

    // Traer role_id del usuario
    const { data: user, error: userErr } = await sb
      .from("app_users")
      .select("id, role_id, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user || user.is_active === false || !user.role_id) {
      return NextResponse.json({ data: [], error: null } satisfies ApiResp<string[]>, { status: 200 });
    }

    // role_permissions.permission_id es UUID => hay que resolver contra permissions.key
    const { data: perms, error: permsErr } = await sb
      .from("role_permissions")
      .select("permission_id, permissions:permission_id(id,key)")
      .eq("role_id", user.role_id);

    if (permsErr) throw permsErr;

    const keys = extractPermissionKeys(perms);

    return NextResponse.json({ data: keys, error: null } satisfies ApiResp<string[]>, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
