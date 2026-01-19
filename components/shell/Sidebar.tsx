"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const items = [
    { label: "Dashboard", href: "/admin" },
    { label: "Empresas", href: "/admin/empresas" },
    { label: "Rubros", href: "/admin/rubros" },
    { label: "Leads", href: "/admin/leads" },
    { label: "Socios", href: "/admin/socios" },
    { label: "Reportes", href: "/admin/reportes" },
    { label: "Eventos", href: "/admin/eventos" },
    { label: "Configuración", href: "/admin/configuracion" },
  ];

  return (
    <aside className="h-screen bg-slate-900 text-slate-200 flex flex-col">
      
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <div className="font-bold text-lg text-white">
          Cámara Costa
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((it) => {
 const active =
 pathname === it.href ||
 (it.href !== "/admin" && pathname.startsWith(it.href + "/"));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "block rounded-md px-4 py-2 text-sm transition",
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 text-xs text-slate-400">
        Admin Cámara<br />
        v1.0
      </div>
    </aside>
  );
}