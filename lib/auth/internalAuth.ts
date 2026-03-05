import type { SupabaseClient } from "@supabase/supabase-js";

const SESSION_COOKIE_NAME = "crm_session";
const SESSION_DAYS = 7;

/** Hash de contraseña (solo usar en server/Node, no en Edge). */
export async function hashPassword(plain: string): Promise<string> {
  const { hash } = await import("bcryptjs");
  return hash(plain, 10);
}

/** Verificar contraseña (solo usar en server/Node). */
export async function verifyPassword(plain: string, hashStr: string): Promise<boolean> {
  const { compare } = await import("bcryptjs");
  return compare(plain, hashStr);
}

/** SHA-256 del token en hex (compatible Node + Edge). */
export async function tokenHash(token: string): Promise<string> {
  const buf = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Genera token aleatorio (hex). Compatible Node y Edge. */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Crea sesión: token, guarda hash en app_sessions.
 * Retorna { token, expiresAt } para que el route setee la cookie.
 */
export async function createSession(
  userId: string,
  admin: SupabaseClient
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const hashed = await tokenHash(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await admin.from("app_sessions").insert({
    user_id: userId,
    token_hash: hashed,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error("Error creando sesión: " + error.message);
  return { token, expiresAt };
}

/**
 * Obtiene user_id desde cookie (hash del token en app_sessions, expires_at > now).
 * Retorna null si no hay cookie o sesión inválida.
 */
export async function getSessionUser(
  cookieValue: string | null | undefined,
  admin: SupabaseClient
): Promise<{ userId: string } | null> {
  if (!cookieValue || !cookieValue.trim()) return null;
  const hashed = await tokenHash(cookieValue.trim());

  const { data, error } = await admin
    .from("app_sessions")
    .select("user_id")
    .eq("token_hash", hashed)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data?.user_id) return null;
  return { userId: data.user_id as string };
}

/**
 * Borra la sesión por token y retorna opciones para limpiar la cookie.
 */
export async function destroySession(
  cookieValue: string | null | undefined,
  admin: SupabaseClient
): Promise<void> {
  if (!cookieValue?.trim()) return;
  const hashed = await tokenHash(cookieValue.trim());
  await admin.from("app_sessions").delete().eq("token_hash", hashed);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/** Opciones para Set-Cookie de la sesión (HttpOnly, Secure en prod). */
export function sessionCookieOptions(token: string, expiresAt: Date): { name: string; value: string; options: Record<string, unknown> } {
  const isProd = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax" as const,
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      expires: expiresAt,
    },
  };
}

/** Header Set-Cookie para limpiar la sesión. */
export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
