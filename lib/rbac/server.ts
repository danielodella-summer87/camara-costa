import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { extractPermissionKeys } from "./extractPermissionKeys";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Obtiene el auth_user_id de la sesión actual (para usar en Server Components).
 */
export async function getActiveUserId(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Devuelve la lista de permission keys (strings) del usuario de la sesión.
 * Lookup por app_users.auth_user_id. Retorna [] si no hay sesión o no hay permisos.
 */
export async function getActiveUserPermissions(): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return [];

  const sb = supabaseAdmin();
  if (!sb) return [];

  const { data: appUser, error: userErr } = await sb
    .from("app_users")
    .select("role_id, is_active")
    .eq("auth_user_id", authUser.id)
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
