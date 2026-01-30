import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Obtiene el userId activo desde la cookie x-user-id o fallback al primer usuario activo.
 * Para usar en Server Components (layout, page, etc.).
 */
export async function getActiveUserId(): Promise<string | null> {
  const sb = supabaseAdmin();
  if (!sb) return null;

  const cookieStore = await cookies();
  const userId = cookieStore.get("x-user-id")?.value ?? null;
  if (userId) return userId;

  const { data: first } = await sb
    .from("app_users")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return first?.id ?? null;
}

/**
 * Devuelve la lista de permission keys (strings) del usuario activo.
 * Para usar en Server Components. Retorna [] si no hay usuario o no hay permisos.
 */
export async function getActiveUserPermissions(): Promise<string[]> {
  const sb = supabaseAdmin();
  if (!sb) return [];

  const userId = await getActiveUserId();
  if (!userId) return [];

  const { data: user, error: userErr } = await sb
    .from("app_users")
    .select("id, role_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (userErr || !user || user.is_active === false || !user.role_id) return [];

  const { data: perms, error: permsErr } = await sb
    .from("role_permissions")
    .select("permission_id, permissions:permission_id(key)")
    .eq("role_id", user.role_id);

  if (permsErr) return [];

  return (perms ?? [])
    .map((x: { permissions?: { key?: string } }) => (x?.permissions?.key ?? "").toString().trim())
    .filter(Boolean);
}

/**
 * Devuelve true si el usuario activo tiene el permiso indicado.
 */
export async function hasPermission(permissionKey: string): Promise<boolean> {
  const permissions = await getActiveUserPermissions();
  return permissions.includes(permissionKey);
}
