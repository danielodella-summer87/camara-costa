import Link from "next/link";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Socios", href: "/admin/socios" },
  { label: "Empresas", href: "/admin/empresas" },
  { label: "Eventos", href: "/admin/eventos" },
  { label: "Leads", href: "/admin/leads" },
  { label: "Reportes", href: "/admin/reportes" },
  { label: "Configuración", href: "/admin/configuracion" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-zinc-950 text-zinc-100">
      <div className="px-6 py-4 text-lg font-semibold">
        Cámara Ciudad de la Costa
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors hover:bg-zinc-800"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-zinc-800 px-6 py-4 text-sm text-zinc-400">
        Admin Panel
      </div>
    </aside>
  );
}