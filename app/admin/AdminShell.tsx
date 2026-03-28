"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import UserMenu from "@/app/admin/components/UserMenu";
import { usePersonalizacion } from "@/lib/personalizacion";
import { BreadcrumbContext } from "@/app/admin/context/BreadcrumbContext";
import { mergeAdminSidebarModules, type AdminSidebarModule } from "@/lib/admin/adminSidebarModules";
import { APP_SUITE_CONFIG } from "@/lib/config/appSuiteConfig";

const SIDEBAR_STORAGE_KEY = "admin_sidebar_collapsed";

type RoleKey = "admin" | "operador" | "comercial" | "viewer";

type MeResponse = {
  authed: boolean;
  app_user?: {
    role?: string | null;
  };
};

function cx(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/dashboard") return pathname === "/admin/dashboard";
  return pathname.startsWith(href);
}

/** Partes del breadcrumb: [ suite, sección, … ]. */
function getBreadcrumbParts(
  pathname: string | null,
  breadcrumbSegment: string | null,
  clientePlural: string
): string[] {
  const suite = APP_SUITE_CONFIG.suiteName;

  if (!pathname || !pathname.startsWith("/admin")) return [suite, "Dashboard"];

  const segments = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);

  if (pathname === "/admin") return [suite, "Centro de control rápido"];
  if (pathname === "/admin/dashboard") return [suite, "Dashboard"];

  if (pathname.startsWith("/admin/leads/") && segments[0] === "leads" && segments[1] === "kanban")
    return [suite, "Leads", "Pipeline visual"];
  if (pathname.startsWith("/admin/leads/") && segments[0] === "leads" && segments.length >= 2) {
    const last = breadcrumbSegment?.trim() || "Detalle";
    return [suite, "Leads", last];
  }
  if (pathname.startsWith("/admin/leads87/") && segments[0] === "leads87" && segments.length >= 2) {
    const last = breadcrumbSegment?.trim() || "Oportunidad";
    return [suite, APP_SUITE_CONFIG.modules.leads.name, last];
  }
  if (pathname.startsWith("/admin/leads87")) return [suite, APP_SUITE_CONFIG.modules.leads.name];
  if (pathname.startsWith("/admin/leads")) return [suite, "Leads", "Gestión operativa"];
  if (pathname.startsWith("/admin/leadsok")) return [suite, "LeadsOk"];
  if (pathname.startsWith("/admin/copilot")) return [suite, APP_SUITE_CONFIG.modules.copilot.name];

  const labelMap: Record<string, string> = {
    empresas: "Iniciativas",
    socios: "Clientes",
    dashboard: "Dashboard",
    agenda: "Agenda",
    reuniones: "Reuniones",
    operaciones: "Operaciones",
    reportes: "Reportes",
    oportunidades: "Oportunidades",
    leads87: APP_SUITE_CONFIG.modules.leads.name,
    copilot: APP_SUITE_CONFIG.modules.copilot.name,
    eventos: "Eventos",
    "mesa-de-ayuda": "Mesa de ayuda",
    neuroventas: "Manual de neuroventas",
    configuracion: "Configuración",
    personalizacion: "Personalización",
  };
  const first = segments[0] ?? "";
  const label = labelMap[first] ?? first;
  return [suite, label];
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
 * Mesa de ayuda se muestra para todos los roles que mantengan el ítem en el menú mergeado.
 * - admin: ve todo
 * - comercial: oculta Configuración y Personalización
 * - operador: oculta Configuración y Personalización
 * - viewer: oculta Socios/Clientes, Agenda y Eventos (prefijos legacy aún filtrados)
 */
function filterNavByRole(role: RoleKey | null, nav: AdminSidebarModule[]): AdminSidebarModule[] {
  if (!role) return nav;
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
  const { clientePlural } = usePersonalizacion();
  const [sidebarModules, setSidebarModules] = useState<AdminSidebarModule[]>(() =>
    mergeAdminSidebarModules(undefined)
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

  useEffect(() => {
    let cancelled = false;
    async function loadSidebar() {
      try {
        const res = await fetch("/api/admin/config/portal", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const json = (await res.json()) as { data?: { sidebar_modules?: unknown } };
        if (!cancelled && json?.data) {
          const merged = mergeAdminSidebarModules(json.data.sidebar_modules as never);
          if (process.env.NODE_ENV === "development") {
            console.debug("[AdminShell] sidebar tras portal + merge", {
              hasPersistedSidebar: Array.isArray(json.data.sidebar_modules),
              count: merged.length,
              keys: merged.map((m) => m.key),
            });
          }
          setSidebarModules(merged);
        }
      } catch {
        /* defaults ya en estado inicial */
      }
    }
    void loadSidebar();
    const onPortalUpdate = () => void loadSidebar();
    window.addEventListener("portal-config-updated", onPortalUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("portal-config-updated", onPortalUpdate);
    };
  }, []);

  const filteredNav = useMemo(() => {
    const visible = sidebarModules.filter((m) => m.status !== "oculto");
    return filterNavByRole(role, visible);
  }, [role, sidebarModules]);

  const mainNav = useMemo(
    () => filteredNav.filter((m) => m.navGroup !== "footer"),
    [filteredNav]
  );
  const footerNav = useMemo(
    () => filteredNav.filter((m) => m.navGroup === "footer"),
    [filteredNav]
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [breadcrumbSegment, setBreadcrumbSegment] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbSegment(null);
  }, [pathname]);

  const breadcrumbParts = useMemo(
    () => getBreadcrumbParts(pathname, breadcrumbSegment, clientePlural),
    [pathname, breadcrumbSegment, clientePlural]
  );

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
        {/* Sidebar — drawer en mobile (siempre w-64 para que al abrir se vea), colapsable en desktop */}
        <aside
          className={cx(
            "bg-[#0b1220] text-white border-r border-white/10",
            "fixed md:static inset-y-0 left-0 z-40",
            "flex flex-col min-h-0",
            "transition-[width,transform] duration-200 ease-out",
            "w-64",
            sidebarCollapsed && "md:w-0 md:overflow-hidden",
            !sidebarCollapsed && "md:w-64",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="p-4 border-b border-white/10">
            <div className="rounded-xl overflow-hidden bg-white/5 p-3 flex items-center justify-center">
              <img
                src="/licencia.png"
                alt={`${APP_SUITE_CONFIG.suiteName} — identidad visual`}
                className="max-h-24 object-contain"
              />
            </div>
          </div>

          <nav className="p-3 space-y-1 flex flex-col flex-1 min-h-0">
            {mainNav.map((item) => {
              const active = isActive(pathname, item.href);
              const isActivo = item.status === "activo";
              const isPrep = item.status === "en_preparacion";
              const displayLabel = item.useMemberPluralLabel
                ? clientePlural.trim() || "Socios"
                : item.label;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
                      setMobileOpen(false);
                    }
                  }}
                  className={cx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActivo
                      ? active
                        ? "bg-white/10 font-semibold text-white"
                        : "font-semibold text-white hover:bg-white/5 hover:text-white"
                      : isPrep
                        ? active
                          ? "bg-white/5 font-normal text-gray-300"
                          : "cursor-not-allowed font-normal text-gray-400 opacity-70 hover:bg-transparent hover:text-gray-400"
                        : active
                          ? "bg-white/5 font-normal text-gray-300"
                          : "font-normal text-gray-400"
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center text-lg leading-none" aria-hidden>
                    {item.icon || "·"}
                  </span>
                  <span>{displayLabel}</span>
                </Link>
              );
            })}
            {footerNav.length > 0 ? (
              <>
                <div className="mx-1 my-2 border-t border-white/10 pt-2 space-y-1" role="presentation" />
                {footerNav.map((item) => {
                  const active = isActive(pathname, item.href);
                  const isActivo = item.status === "activo";
                  const isPrep = item.status === "en_preparacion";
                  const displayLabel = item.useMemberPluralLabel
                    ? clientePlural.trim() || "Socios"
                    : item.label;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => {
                        if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
                          setMobileOpen(false);
                        }
                      }}
                      className={cx(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        isActivo
                          ? active
                            ? "bg-white/10 font-semibold text-white"
                            : "font-semibold text-white hover:bg-white/5 hover:text-white"
                          : isPrep
                            ? active
                              ? "bg-white/5 font-normal text-gray-300"
                              : "cursor-not-allowed font-normal text-gray-400 opacity-70 hover:bg-transparent hover:text-gray-400"
                            : active
                              ? "bg-white/5 font-normal text-gray-300"
                              : "font-normal text-gray-400"
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-lg leading-none" aria-hidden>
                        {item.icon || "·"}
                      </span>
                      <span>{displayLabel}</span>
                    </Link>
                  );
                })}
              </>
            ) : null}
          </nav>

          <div className="mt-auto p-4 border-t border-white/10">
            {roleLoading ? (
              <div className="rounded-xl bg-white/5 p-3 text-xs text-white/60">Cargando…</div>
            ) : (
              <div className="rounded-xl bg-white/5 p-3 text-xs text-white/70">
                {APP_SUITE_CONFIG.suiteName} • panel admin
              </div>
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
                  {breadcrumbParts.slice(0, -1).map((part, i) => (
                    <span key={`bc-${i}-${part}`}>
                      {part}
                      {" / "}
                    </span>
                  ))}
                  <span className="text-gray-900 font-medium">
                    {breadcrumbParts[breadcrumbParts.length - 1] ?? ""}
                  </span>
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
          <main className="p-6">
            <BreadcrumbContext.Provider value={{ setBreadcrumbSegment }}>
              {children}
            </BreadcrumbContext.Provider>
          </main>
        </div>
      </div>
    </div>
  );
}
