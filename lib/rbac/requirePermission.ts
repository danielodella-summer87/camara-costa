import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { extractPermissionKeys } from "./extractPermissionKeys";

const PERMISSION_ALIASES: Record<string, string> = {
  "leads.create": "leads.write",
};

type AppUser = {
  id: string;
  role_id: string;
};

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function getCookieFromHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

function resolvePermissionKey(permissionKey: string): string {
  return PERMISSION_ALIASES[permissionKey] ?? permissionKey;
}

/** Usuario activo y claves de permiso efectivas del rol (sin comprobar una clave concreta). */
async function loadUserWithPermissionKeys(req: Request): Promise<{ user: AppUser; keys: string[] } | null> {
  const sb = supabaseAdmin();
  if (!sb) return null;

  let userId =
    getCookieFromHeader(req.headers.get("cookie"), "x-user-id") ??
    null;

  if (!userId) {
    try {
      const cookieStore = await cookies();
      userId = cookieStore.get("x-user-id")?.value ?? null;
    } catch {
      userId = null;
    }
  }

  if (!userId) {
    const { data: admin } = await sb
      .from("app_users")
      .select("id, role_id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!admin) return null;
    userId = admin.id;
  }

  const { data: user } = await sb
    .from("app_users")
    .select("id, role_id")
    .eq("id", userId)
    .maybeSingle();

  if (!user) return null;

  const { data: perms, error: permsErr } = await sb
    .from("role_permissions")
    .select("permission_id, permissions:permission_id(key)")
    .eq("role_id", user.role_id);

  if (permsErr) return null;

  const keys = extractPermissionKeys(perms);

  return { user: user as AppUser, keys };
}

export async function requirePermission(req: Request, permissionKey: string) {
  const ctx = await loadUserWithPermissionKeys(req);
  if (!ctx) return null;
  const key = resolvePermissionKey(permissionKey);
  if (!ctx.keys.includes(key)) return null;
  return ctx.user;
}

/**
 * Autoriza si el usuario tiene al menos uno de los permisos indicados (tras aplicar alias).
 */
export async function requireAnyPermission(req: Request, permissionKeys: readonly string[]) {
  const ctx = await loadUserWithPermissionKeys(req);
  if (!ctx) return null;
  const resolved = permissionKeys.map((k) => resolvePermissionKey(k));
  if (!resolved.some((k) => ctx.keys.includes(k))) return null;
  return ctx.user;
}
