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
  };
  return map[r] ?? r.charAt(0).toUpperCase() + r.slice(1);
}

export default function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const json = (await res.json()) as MeResponse;
        if (!alive) return;
        setMe(json);
      } catch {
        if (!alive) return;
        setMe(null);
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
    const fromApp = me?.app_user?.nombre?.trim();
    if (fromApp) return fromApp;

    const meta = me?.user?.user_metadata;
    return (
      meta?.full_name?.trim() ||
      meta?.name?.trim() ||
      me?.user?.email?.split("@")[0] ||
      "Usuario"
    );
  }, [me]);

  const roleLabel = useMemo(() => {
    return roleToLabel(me?.app_user?.role ?? null);
  }, [me]);

  const avatarUrl = useMemo(() => {
    const meta = me?.user?.user_metadata;
    return meta?.picture || meta?.avatar_url || "";
  }, [me]);

  async function handleLogout() {
    try {
      // Si tenés endpoint propio de logout, usalo.
      // Si no existe, esto igual sirve si la app ya maneja borrar cookies en /auth/logout.
      await fetch("/auth/logout", { method: "POST" }).catch(() => null);
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
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-7 w-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-gray-200" />
        )}

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
          className="absolute right-0 mt-2 w-64 rounded-xl border bg-white p-2 shadow-lg"
          role="menu"
        >
          <div className="px-2 py-2">
            <div className="text-sm font-medium">{displayName}</div>
            <div className="text-xs text-gray-500">{me?.user?.email ?? ""}</div>
            <div className="mt-1 text-xs text-gray-500">
              Rol: <span className="font-medium text-gray-700">{roleLabel}</span>
            </div>
          </div>

          <div className="my-2 h-px bg-gray-100" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/admin/configuracion/usuarios");
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
            role="menuitem"
          >
            Usuarios y roles
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/admin/configuracion/roles");
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
            role="menuitem"
          >
            Roles
          </button>

          <div className="my-2 h-px bg-gray-100" />

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            role="menuitem"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
