"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";


export default function Sidebar() {
  const pathname = usePathname();

  const items = [
    { label: "Dashboard", href: "/admin" },
    { label: "Socios", href: "/admin/socios" },
    { label: "Empresas", href: "/admin/empresas" },
    { label: "Eventos", href: "/admin/eventos" },
    { label: "Leads", href: "/admin/leads" },
    { label: "Reportes", href: "/admin/reportes" },
    { label: "Configuración", href: "/admin/configuracion" },
  ];

  return (
    <aside className="h-screen border-r bg-white">
      <div className="p-4 font-semibold">Admin</div>
      <nav className="px-2 space-y-1">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "block rounded-md px-3 py-2 text-sm",
                active ? "bg-gray-100 font-medium" : "hover:bg-gray-50",
              ].join(" ")}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}