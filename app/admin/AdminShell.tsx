"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = { label: string; href: string };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Entidades", href: "/admin/empresas" },
  { label: "Leads", href: "/admin/leads" },
  { label: "Socios", href: "/admin/socios" },
  { label: "Agenda", href: "/admin/agenda" },
  { label: "Operaciones", href: "/admin/operaciones" },
  { label: "Reportes", href: "/admin/reportes" },
  { label: "Eventos", href: "/admin/eventos" },
  { label: "Mesa de ayuda", href: "/admin/mesa-de-ayuda" },
  { label: "IA", href: "/admin/configuracion/ia" },
  { label: "Personalización", href: "/admin/personalizacion" },
  { label: "Configuración", href: "/admin/configuracion" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [mobileOpen, setMobileOpen] = useState(false);

  // Cierra el menú cuando cambia la ruta (ej. tocás "Leads" → navega → se cierra solo)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const userLabel = "Usuario"; // luego lo conectamos a app_users/auth

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={cx(
            "w-64 bg-[#0b1220] text-white border-r border-white/10",
            "fixed md:static inset-y-0 left-0 z-40",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            "transition-transform duration-200"
          )}
        >
          {/* Logo / Brand */}
          <div className="p-4 border-b border-white/10">
            <div className="rounded-xl overflow-hidden bg-white/5 p-3 flex items-center justify-center">
              <img
                src="/licencia.png"
                alt="Licencia Cámara Costa"
                className="max-h-24 object-contain"
              />
            </div>
          </div>

          {/* Nav */}
          <nav className="p-3 space-y-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
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
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/80 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer / Mini badge */}
          <div className="mt-auto p-4 border-t border-white/10">
            <div className="rounded-xl bg-white/5 p-3 text-xs text-white/70">
              Cámara Costa • Admin UI
            </div>
          </div>
        </aside>

        {/* Overlay mobile */}
        {mobileOpen ? (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        {/* Main */}
        <div className="flex-1 md:ml-0">
          {/* Topbar */}
          <header className="sticky top-0 z-20 bg-white border-b">
            <div className="h-14 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden border rounded-lg px-3 py-2 text-sm"
                  onClick={() => setMobileOpen((v) => !v)}
                >
                  Menú
                </button>

                <div className="text-sm text-gray-500">
                  Admin / <span className="text-gray-900 font-medium">Dashboard</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="text-xl leading-none" aria-label="Notificaciones">
                  🔔
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700">
                    U
                  </div>
                  <div className="text-sm text-gray-700">{userLabel}</div>
                </div>
                <button
                  className="border rounded-lg px-3 py-2 text-sm"
                  onClick={onLogout}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
