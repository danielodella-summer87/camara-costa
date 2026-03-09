"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import UserMenu from "@/app/admin/components/UserMenu";
import { usePersonalizacion } from "@/lib/personalizacion";
import { resolveUILabel } from "@/lib/ui/labels";

const SIDEBAR_STORAGE_KEY = "admin_sidebar_collapsed";

type NavItem = { label: string; href: string };
type RoleKey = "admin" | "operador" | "comercial" | "viewer";

type MeResponse = {
  authed: boolean;
  app_user?: {
    role?: string | null;
  };
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Iniciativas", href: "/admin/empresas" },
  { label: "Leads", href: "/admin/leads" },
  { label: "socios", href: "/admin/socios" },
  { label: "Agenda", href: "/admin/agenda" },
  { label: "Reuniones", href: "/admin/reuniones" },
  { label: "Operaciones", href: "/admin/operaciones" },
  { label: "Reportes", href: "/admin/reportes" },
  { label: "Eventos", href: "/admin/eventos" },
  { label: "Mesa de ayuda", href: "/admin/mesa-de-ayuda" },
  { label: "Manual de neuroventas", href: "/admin/neuroventas" },
  { label: "IA", href: "/admin/configuracion/ia" },
  { label: "Personalización", href: "/admin/personalizacion" },
  { label: "Configuración", href: "/admin/configuracion" },
];

function cx(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

function normalizeRole(role: string | null | undefined): RoleKey | null {
  if (!role) return null;
  const r = role.trim().toLowerCase();
  if (r === "admin" || r === "operador" || r === "comercial" || r === "viewer") return r;
  if (r === "operaciones") return "operador";
  if (r === "solo_lectura" || r === "gerencia") return "viewer";
  return null;
}

/**
 * Filtra items del NAV según rol (app_user.role desde /api/auth/me).
 * Mesa de ayuda se muestra para TODOS los roles.
 * - admin: ve todo
 * - comercial: Dashboard, Iniciativas, Leads, Socios, Agenda, Reportes, Eventos, Mesa de ayuda. NO: Operaciones, IA, Personalización, Configuración
 * - operador: Dashboard, Leads, Operaciones, Mesa de ayuda, Agenda, Reportes (+ Iniciativas, Socios, Eventos). NO: IA, Personalización, Configuración
 * - viewer: Dashboard, Iniciativas, Leads, Reportes, Mesa de ayuda (lectura). NO: Operaciones, IA, Personalización, Configuración, Socios, Agenda, Eventos
 */
function filterNavByRole(role: RoleKey | null, nav: NavItem[]): NavItem[] {
  if (!role) return nav; // mientras carga: NAV completo para evitar flicker
  if (role === "admin") return nav;

  const hiddenByRole: Record<RoleKey, string[]> = {
    admin: [],
    comercial: [
      "/admin/operaciones",
      "/admin/configuracion",
      "/admin/personalizacion",
    ],
    operador: ["/admin/configuracion", "/admin/personalizacion"],
    viewer: [
      "/admin/operaciones",
      "/admin/configuracion",
      "/admin/personalizacion",
      "/admin/socios",
      "/admin/agenda",
      "/admin/eventos",
    ],
  };

  const hiddenPrefixes = hiddenByRole[role] ?? [];
  return nav.filter(
    (item) =>
      !hiddenPrefixes.some(
        (p) => item.href === p || item.href.startsWith(p + "/")
      )
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { clientePlural, clienteSingular } = usePersonalizacion();
  const personalizacion = useMemo(
    () => ({ clientePlural, clienteSingular }),
    [clientePlural, clienteSingular]
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<RoleKey | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    setRoleLoading(true);

    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const json = (await r.json()) as MeResponse;
        const parsed = normalizeRole(json?.app_user?.role ?? null);
        if (!cancelled) {
          setRole(parsed);
          setRoleLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRole(null);
          setRoleLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredNav = useMemo(() => filterNavByRole(role, NAV), [role]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_STORAGE_KEY) : null;
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar — colapsable en desktop */}
        <aside
          className={cx(
            "bg-[#0b1220] text-white border-r border-white/10",
            "fixed md:static inset-y-0 left-0 z-40",
            "transition-[width,transform] duration-200 ease-out",
            sidebarCollapsed ? "w-0 md:w-0 overflow-hidden" : "w-64",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="p-4 border-b border-white/10">
            <div className="rounded-xl overflow-hidden bg-white/5 p-3 flex items-center justify-center">
              <img src="/licencia.png" alt="Licencia Cámara Costa" className="max-h-24 object-contain" />
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {filteredNav.map((item) => {
              const active = isActive(pathname, item.href);
              const resolvedLabel = resolveUILabel(item.label as any, personalizacion);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
                      setMobileOpen(false);
                    }
                  }}
                  className={cx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                    active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span>{resolvedLabel}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto p-4 border-t border-white/10">
            {roleLoading ? (
              <div className="rounded-xl bg-white/5 p-3 text-xs text-white/60">Cargando…</div>
            ) : (
              <div className="rounded-xl bg-white/5 p-3 text-xs text-white/70">Cámara Costa • Admin UI</div>
            )}
          </div>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
        ) : null}

        <div className={cx("flex-1 flex flex-col min-w-0", sidebarCollapsed ? "md:ml-0" : "md:ml-0")}>
          <header className="sticky top-0 z-20 bg-white border-b">
            <div className="h-14 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="md:hidden border rounded-lg px-3 py-2 text-sm"
                  onClick={() => setMobileOpen((v) => !v)}
                  aria-label="Abrir menú"
                >
                  Menú
                </button>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                  aria-label={sidebarCollapsed ? "Mostrar menú lateral" : "Ocultar menú lateral"}
                  title={sidebarCollapsed ? "Mostrar menú" : "Ocultar menú"}
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen className="w-5 h-5" aria-hidden />
                  ) : (
                    <PanelLeftClose className="w-5 h-5" aria-hidden />
                  )}
                </button>
                <div className="text-sm text-gray-500">
                  Admin / <span className="text-gray-900 font-medium">Dashboard</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-xl leading-none" aria-label="Notificaciones">
                  🔔
                </button>
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
