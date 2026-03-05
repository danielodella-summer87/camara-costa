import { cookies } from "next/headers";

export type CrmRole = "superadmin" | "admin" | "staff" | "member";

export type CrmSession = {
  id: string;
  role: CrmRole;
};

const COOKIE_NAME = "crm_session";

export function getDashboardPath(role: string): string {
  switch (role) {
    case "superadmin":
      return "/app/superadmin";
    case "admin":
      return "/app/admin";
    case "staff":
      return "/app/staff";
    case "member":
      return "/app/member";
    default:
      return "/login";
  }
}

function isValidRole(role: any): role is CrmRole {
  return role === "superadmin" ||
         role === "admin" ||
         role === "staff" ||
         role === "member";
}

export async function setSessionCookie(session: CrmSession) {
  if (!session?.id || !isValidRole(session.role)) return;

  const value = Buffer
    .from(JSON.stringify(session), "utf8")
    .toString("base64url");

  const store = await cookies();
  store.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function getSession(): Promise<CrmSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json);

    if (!parsed?.id || !isValidRole(parsed.role)) return null;

    return {
      id: String(parsed.id),
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export async function clearSession() {
  const store = await cookies();
  store.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
