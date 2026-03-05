"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MeResponse = {
  authed: boolean;
  user?: {
    email?: string | null;
    user_metadata?: {
      full_name?: string;
      name?: string;
      picture?: string;
      avatar_url?: string;
    };
  } | null;
  app_user?: {
    email?: string | null;
    nombre?: string | null;
    role?: string | null;
    is_active?: boolean | null;
  } | null;
};

function roleToLabel(role: string | null | undefined) {
  if (!role) return "Sin rol";
  const r = role.trim().toLowerCase();
  const map: Record<string, string> = {
    admin: "Admin",
    operador: "Operador",
    comercial: "Comercial",
    viewer: "Viewer",
    marketing: "Marketing",
    administracion: "Administración",
    tecnico: "Técnico",
  };
  return map[r] ?? r.charAt(0).toUpperCase() + r.slice(1);
}

const roleColorMap: Record<string, { bg: string; text: string }> = {
  admin: { bg: "bg-blue-600", text: "text-blue-600" },
  comercial: { bg: "bg-green-600", text: "text-green-600" },
  marketing: { bg: "bg-pink-500", text: "text-pink-600" },
  administracion: { bg: "bg-amber-500", text: "text-amber-700" },
  tecnico: { bg: "bg-violet-500", text: "text-violet-600" },
};
const defaultRoleColor = { bg: "bg-gray-400", text: "text-gray-600" };

/** Detecta si un valor parece username técnico (ej: test-comercial, user_123). */
function isTechnicalUsername(s: string | null | undefined): boolean {
  if (!s || !s.trim()) return true;
  const t = s.trim().toLowerCase();
  if (t.length < 2) return true;
  if (/^test[-_]/.test(t) || /^user[-_]?\d*$/.test(t)) return true;
  if (t === "admin") return true;
  return false;
}

/**
 * Nombre humano para mostrar. Prioridad: profile.nombre → full_name → name → email (antes del @).
 * Solo primer nombre; evita usernames técnicos como "test-comercial".
 */
function getDisplayName(me: MeResponse | null): string {
  if (!me) return "Usuario";

  const appNombre = me?.app_user?.nombre?.trim();
  if (appNombre && !isTechnicalUsername(appNombre)) {
    return appNombre.split(/\s+/)[0] ?? appNombre;
  }

  const meta = me?.user?.user_metadata;
  const fullName = meta?.full_name?.trim();
  if (fullName && !isTechnicalUsername(fullName)) {
    return fullName.split(/\s+/)[0] ?? fullName;
  }

  const name = meta?.name?.trim();
  if (name && !isTechnicalUsername(name)) {
    return name.split(/\s+/)[0] ?? name;
  }

  const email = me?.user?.email;
  if (email && typeof email === "string" && email.includes("@")) {
    return email.split("@")[0];
  }

  return "Usuario";
}

/** Sesión CRM (prototipo cédula+PIN). Fallback cuando app_user es null. */
type CrmSession = { id: string; role: string } | null;

export default function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [crm, setCrm] = useState<CrmSession>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const [meRes, protoRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/proto/me", { cache: "no-store" }),
        ]);
        const meJson = (await meRes.json()) as MeResponse;
        const protoJson = await protoRes.json().catch(() => ({}));
        if (!alive) return;
        setMe(meJson);
        setCrm(
          protoJson?.authed === true && protoJson?.session?.id && protoJson?.session?.role
            ? { id: protoJson.session.id, role: protoJson.session.role }
            : null
        );
      } catch {
        if (!alive) return;
        setMe(null);
        setCrm(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const displayName = useMemo(() => {
    const fromMe = getDisplayName(me);
    if (fromMe !== "Usuario") return fromMe;
    if (crm) return "Prototipo";
    return fromMe;
  }, [me, crm]);

  const roleLabel = useMemo(() => {
    if (me?.app_user?.role != null && me.app_user.role !== "") return roleToLabel(me.app_user.role);
    if (crm?.role) return roleToLabel(crm.role);
    return "Sin rol";
  }, [me?.app_user?.role, crm]);

  const initial = useMemo(() => {
    const first = displayName.trim().charAt(0);
    return first ? first.toUpperCase() : "U";
  }, [displayName]);

  const roleColor = useMemo(() => {
    const role = (me?.app_user?.role ?? crm?.role)?.trim()?.toLowerCase();
    if (!role) return defaultRoleColor;
    const key = role.normalize("NFD").replace(/\u0300/g, "");
    return roleColorMap[key] ?? defaultRoleColor;
  }, [me?.app_user?.role, crm?.role]);

  async function handleLogout() {
    try {
      // Si tenés endpoint propio de logout, usalo.
      // Si no existe, esto igual sirve si la app ya maneja borrar cookies en /auth/logout.
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border px-3 py-1.5 hover:bg-gray-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div
          className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white ${roleColor.bg}`}
          aria-hidden
        >
          {initial}
        </div>

        <div className="flex flex-col items-start leading-tight">
          <div className="text-sm font-medium">{displayName}</div>
          <div className="text-xs text-gray-500">
            {loading ? "Cargando..." : roleLabel}
          </div>
        </div>

        <span className="text-xs text-gray-500">▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-xl border bg-white p-4 shadow-lg"
          role="menu"
        >
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <div
              className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-lg font-semibold text-white ${roleColor.bg}`}
              aria-hidden
            >
              {initial}
            </div>
            <div className="mt-3 w-full min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{displayName}</div>
              <div className="mt-0.5 text-xs text-gray-500 truncate">{me?.user?.email ?? ""}</div>
              <div className={`mt-1.5 text-xs font-medium ${roleColor.text}`}>{roleLabel}</div>
            </div>
          </div>

          <div className="my-3 h-px bg-gray-100" />

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            role="menuitem"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
