import { NextRequest, NextResponse } from "next/server";
import { getAppUserFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";
import { extractPermissionKeys } from "@/lib/rbac/extractPermissionKeys";
import { normalizeRole } from "@/app/lib/rbac";

export const dynamic = "force-dynamic";

type ApiResp<T> = { data?: T | null; error?: string | null };

/**
 * GET /api/admin/permissions/me
 * Devuelve rol y permission keys del usuario de la sesión (auth interno).
 */
export async function GET(req: NextRequest) {
  try {
    const appUser = await getAppUserFromRequest();

    if (!appUser || appUser.is_active === false) {
      return NextResponse.json(
        { user: { role: null }, data: [], error: null },
        { status: 200 }
      );
    }

    const roleName = normalizeRole(appUser.role);

    if (!appUser.role_id) {
      return NextResponse.json(
        { user: { role: roleName }, data: [], error: null },
        { status: 200 }
      );
    }

    const { data: perms, error: permsErr } = await supabaseServer
      .from("role_permissions")
      .select("permission_id, permissions:permission_id(id,key)")
      .eq("role_id", appUser.role_id);

    if (permsErr) throw permsErr;

    const keys = extractPermissionKeys(perms);

    return NextResponse.json(
      { user: { role: roleName }, data: keys, error: null },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json(
      { data: null, error: msg } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
