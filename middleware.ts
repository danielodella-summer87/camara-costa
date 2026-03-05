import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, getSessionCookieName } from "@/lib/auth/internalAuth";
import { canAccessPath } from "@/app/lib/rbac";

const CRM_VALID_ROLES = ["superadmin", "admin", "staff", "member"];

function decodeCrmSessionCookie(value: string): { id: string; role: string } | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed?.id && typeof parsed.role === "string" && CRM_VALID_ROLES.includes(parsed.role)) {
      return { id: String(parsed.id), role: parsed.role };
    }
  } catch {
    // invalid
  }
  return null;
}

type DebugCookies = {
  expectedName: string;
  expected: string | undefined;
  legacy: string | undefined;
  crm: string | undefined;
  path: string;
};

function addDebugHeaders(res: NextResponse, debug: DebugCookies): NextResponse {
  if (process.env.NODE_ENV === "production") return res;
  res.headers.set("x-debug-expected-cookie-name", debug.expectedName);
  res.headers.set("x-debug-expected-cookie-present", debug.expected != null ? "1" : "0");
  res.headers.set("x-debug-legacy-cc-session-present", debug.legacy != null ? "1" : "0");
  res.headers.set("x-debug-crm-session-present", debug.crm != null ? "1" : "0");
  res.headers.set("x-debug-path", debug.path);
  return res;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const expectedName = getSessionCookieName();
  const expected = req.cookies.get(expectedName)?.value;
  const legacy = req.cookies.get("cc_session")?.value;
  const crm = req.cookies.get("crm_session")?.value;
  const debug: DebugCookies = { expectedName, expected, legacy, crm, path: pathname };

  // Validación crm_session (prototipo): si hay cookie válida, dejar pasar
  const crmCookie = req.cookies.get("crm_session")?.value ?? null;
  if (crmCookie) {
    const session = decodeCrmSessionCookie(crmCookie);
    if (session) return addDebugHeaders(NextResponse.next(), debug);
  }

  // Permitir /login siempre
  if (pathname.startsWith("/login") || pathname === "/login") {
    return addDebugHeaders(NextResponse.next(), debug);
  }

  const sessionCookie = req.cookies.get(getSessionCookieName())?.value ?? null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return addDebugHeaders(NextResponse.redirect(loginUrl), debug);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const session = await getSessionUser(sessionCookie, admin);

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
    return addDebugHeaders(NextResponse.redirect(loginUrl), debug);
  }

  const { data: appUser } = await admin
    .from("app_users")
    .select("is_active, roles:role_id(name)")
    .eq("id", session.userId)
    .maybeSingle();

  const rel = (appUser as { roles?: { name?: string } | { name?: string }[] } | null)?.roles;
  const roleFromRelation =
    rel == null ? null : Array.isArray(rel) ? rel[0]?.name ?? null : rel?.name ?? null;
  const isActive = (appUser as { is_active?: boolean } | null)?.is_active ?? false;

  if (!isActive) {
    const deniedUrl = req.nextUrl.clone();
    deniedUrl.pathname = "/403";
    return addDebugHeaders(NextResponse.redirect(deniedUrl), debug);
  }

  if (!canAccessPath({ role: roleFromRelation }, pathname)) {
    const deniedUrl = req.nextUrl.clone();
    deniedUrl.pathname = "/403";
    return addDebugHeaders(NextResponse.redirect(deniedUrl), debug);
  }

  const res = NextResponse.next();
  res.headers.set("x-user-id", session.userId);
  return addDebugHeaders(res, debug);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*"
  ]
};
