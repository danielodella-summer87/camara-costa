import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { extractPermissionKeys } from "@/lib/rbac/extractPermissionKeys";
import { normalizeRole } from "@/app/lib/rbac";

export const dynamic = "force-dynamic";

type ApiResp<T> = { data?: T | null; error?: string | null };

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/admin/permissions/me
 * Devuelve rol y permission keys del usuario de la sesión (app_users por auth_user_id).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { user: { role: null }, data: [], error: null },
        { status: 200 }
      );
    }

    const sb = supabaseAdmin();
    const { data: appUser, error: userErr } = await sb
      .from("app_users")
      .select("roles:role_id(name), is_active, role_id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!appUser || appUser.is_active === false) {
      return NextResponse.json(
        { user: { role: null }, data: [], error: null },
        { status: 200 }
      );
    }

    const rolesRel = (appUser as { roles?: { name?: string } | { name?: string }[] }).roles;
    const roleRaw =
      rolesRel == null
        ? null
        : Array.isArray(rolesRel)
          ? rolesRel[0]?.name ?? null
          : (rolesRel as { name?: string })?.name ?? null;
    const roleName = normalizeRole(roleRaw);

    if (!appUser.role_id) {
      return NextResponse.json(
        { user: { role: roleName }, data: [], error: null },
        { status: 200 }
      );
    }

    const { data: perms, error: permsErr } = await sb
      .from("role_permissions")
      .select("permission_id, permissions:permission_id(id,key)")
      .eq("role_id", appUser.role_id);

    if (permsErr) throw permsErr;

    const keys = extractPermissionKeys(perms);

    return NextResponse.json(
      { user: { role: roleName }, data: keys, error: null },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
