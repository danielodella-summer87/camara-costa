"use client";

import { usePathname } from "next/navigation";
import { usePermissions } from "@/lib/rbac/usePermissions";
import { useEffect, useState } from "react";

const LABELS: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/socios": "Socios",
  "/admin/empresas": "Iniciativas",
  "/admin/eventos": "Eventos",
  "/admin/leads": "Leads",
  "/admin/reportes": "Reportes",
  "/admin/neuroventas": "Manual de neuroventas",
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
  const { permissions, loading } = usePermissions();
  const [userInitial, setUserInitial] = useState("A");

  useEffect(() => {
    // Usar inicial "U" para Usuario por defecto
    setUserInitial("U");
  }, []);

  const displayName = "Usuario";
  const roleLabel = permissions.includes("config.admin") ? "Admin" : permissions.length > 0 ? "Usuario" : "—";

  return (
    <div className="h-full flex items-center justify-between px-6 bg-white border-b border-slate-200">
      
      {/* Left */}
      <div className="flex flex-col">
        <div className="text-sm text-slate-600">
          Bienvenido,{" "}
          <span className="font-medium text-slate-900">
            {loading ? "Cargando..." : displayName}
          </span>
          {roleLabel !== "—" && (
            <span className="ml-2 text-xs text-slate-500">({roleLabel})</span>
          )}
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
            {userInitial}
          </div>
          <span>{loading ? "Cargando..." : displayName}</span>
        </div>
      </div>

    </div>
  );
}