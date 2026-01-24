"use client";

import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/socios": "Socios",
  "/admin/empresas": "Entidades",
  "/admin/eventos": "Eventos",
  "/admin/leads": "Leads",
  "/admin/reportes": "Reportes",
  "/admin/configuracion": "Configuración",
};

function titleFromPath(pathname: string) {
  if (LABELS[pathname]) return LABELS[pathname];

  const base = pathname.split("/").slice(0, 3).join("/");
  if (LABELS[base]) return LABELS[base];

  return "Admin";
}

export function Topbar() {
  const pathname = usePathname();
  const sectionTitle = titleFromPath(pathname);

  return (
    <div className="h-full flex items-center justify-between px-6 bg-white border-b border-slate-200">
      
      {/* Left */}
      <div className="flex flex-col">
        <div className="text-sm text-slate-600">
          Bienvenido,{" "}
          <span className="font-medium text-slate-900">Administrador</span>
        </div>

        {/* Breadcrumb */}
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          <span>Admin</span>
          <span>/</span>
          <span className="text-slate-700 font-medium">{sectionTitle}</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative text-slate-500 hover:text-slate-700">
          🔔
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User */}
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold">
            A
          </div>
          <span>Admin</span>
        </div>
      </div>

    </div>
  );
}