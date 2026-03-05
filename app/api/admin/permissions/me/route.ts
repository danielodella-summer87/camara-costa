import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";
import { extractPermissionKeys } from "@/lib/rbac/extractPermissionKeys";
import { normalizeRole } from "@/app/lib/rbac";

export const dynamic = "force-dynamic";

type ApiResp<T> = { data?: T | null; error?: string | null; user?: Record<string, unknown> | null };

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type AppUserRow = {
  id: string;
  email: string | null;
  role_id: string | null;
  auth_user_id: string | null;
  nombre?: string | null;
  is_active?: boolean | null;
  comercial_id?: string | null;
};

type RoleRow = { id: string; name: string | null; label?: string | null };

/**
 * GET /api/admin/permissions/me
 * Detecta usuario (Supabase auth o sesión interna), resuelve app_users por auth_user_id o email,
 * devuelve rol y permission keys (data: string[]).
 */
export async function GET(req: NextRequest) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    if (!serviceKey || !url) {
      return NextResponse.json(
        { user: null, data: null, error: "SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL no configurados" } satisfies ApiResp<never>,
        { status: 500 }
      );
    }

    const admin = supabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { user: null, data: null, error: "Error inicializando cliente Supabase" } satisfies ApiResp<never>,
        { status: 500 }
      );
    }

    let appUser: AppUserRow | null = null;

    // 1) Intentar Supabase Auth (cookies)
    const supabaseAuth = await createServerSupabase();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();

    if (authUser?.id) {
      const emailNorm = authUser.email?.trim().toLowerCase() ?? null;
      const { data: byAuth } = await admin
        .from("app_users")
        .select("id, email, role_id, auth_user_id, nombre, is_active, comercial_id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      if (byAuth) {
        appUser = byAuth as AppUserRow;
      } else if (emailNorm) {
        const { data: byEmail } = await admin
          .from("app_users")
          .select("id, email, role_id, auth_user_id, nombre, is_active, comercial_id")
          .ilike("email", emailNorm)
          .maybeSingle();
        if (byEmail) appUser = byEmail as AppUserRow;
      }
    }

    // 2) Fallback: sesión interna (cookie cc_session -> app_sessions -> user_id)
    if (!appUser) {
      const internalUserId = await getInternalUserIdFromRequest();
      if (internalUserId) {
        const { data: byId } = await admin
          .from("app_users")
          .select("id, email, role_id, auth_user_id, nombre, is_active, comercial_id")
          .eq("id", internalUserId)
          .maybeSingle();
        if (byId) appUser = byId as AppUserRow;
      }
    }

    if (!appUser) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[permissions/me] No se encontró app_user (auth_user_id o email o sesión interna)");
      }
      return NextResponse.json(
        { user: null, data: null, error: null } satisfies ApiResp<never>,
        { status: 200 }
      );
    }

    if (appUser.is_active === false) {
      return NextResponse.json(
        { user: { id: appUser.id, email: appUser.email, role: null, role_id: null, app_user_id: appUser.id }, data: [], error: null } satisfies ApiResp<string[]>,
        { status: 200 }
      );
    }

    let roleName: string | null = null;
    let roleId: string | null = appUser.role_id;

    if (appUser.role_id) {
      const { data: roleRow } = await admin
        .from("roles")
        .select("id, name, label")
        .eq("id", appUser.role_id)
        .maybeSingle();
      roleName = (roleRow as RoleRow | null)?.name ?? null;
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[permissions/me] app_user sin role_id:", appUser.id);
      }
    }

    const roleNormalized = normalizeRole(roleName);
    let keys: string[] = [];

    if (appUser.role_id) {
      const { data: perms, error: permsErr } = await admin
        .from("role_permissions")
        .select("permission_id, permissions:permission_id(id, key)")
        .eq("role_id", appUser.role_id);

      if (permsErr) throw permsErr;
      keys = extractPermissionKeys((perms ?? null) as Parameters<typeof extractPermissionKeys>[0]).filter(Boolean);
    }

    const userPayload = {
      id: appUser.id,
      email: appUser.email ?? null,
      role: roleNormalized ?? roleName,
      role_id: roleId,
      app_user_id: appUser.id,
      nombre: appUser.nombre ?? null,
      is_active: appUser.is_active ?? true,
      comercial_id: appUser.comercial_id ?? null,
    };

    return NextResponse.json(
      { user: userPayload, data: keys, error: null } satisfies ApiResp<string[]>,
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json(
      { user: null, data: null, error: msg } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
