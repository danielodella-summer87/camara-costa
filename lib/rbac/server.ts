import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";
import { extractPermissionKeys } from "./extractPermissionKeys";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Obtiene el app_users.id de la sesión interna actual.
 */
export async function getActiveUserId(): Promise<string | null> {
  return getInternalUserIdFromRequest();
}

/**
 * Devuelve la lista de permission keys del usuario de la sesión (auth interno).
 * Lookup por app_users.id. Retorna [] si no hay sesión o no hay permisos.
 */
export async function getActiveUserPermissions(): Promise<string[]> {
  const userId = await getInternalUserIdFromRequest();
  if (!userId) return [];

  const sb = supabaseAdmin();
  if (!sb) return [];

  const { data: appUser, error: userErr } = await sb
    .from("app_users")
    .select("role_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (userErr || !appUser || appUser.is_active === false || !appUser.role_id) return [];

  const { data: perms, error: permsErr } = await sb
    .from("role_permissions")
    .select("permission_id, permissions:permission_id(key)")
    .eq("role_id", appUser.role_id);

  if (permsErr) return [];

  return extractPermissionKeys(perms);
}

/**
 * Devuelve true si el usuario activo tiene el permiso indicado.
 */
export async function hasPermission(permissionKey: string): Promise<boolean> {
  const permissions = await getActiveUserPermissions();
  return permissions.includes(permissionKey);
}
