"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  FolderTree, 
  GitBranch, 
  CheckSquare, 
  Sparkles, 
  Users,
  Settings as SettingsIcon,
  LayoutDashboard,
  Building2,
  Target,
  BarChart3,
  CalendarDays
} from "lucide-react";

// TODO: Conectar con el rol real del usuario desde autenticación
type Role = "admin" | "editor" | "viewer";
const currentRole: Role = "admin"; // Mock temporal

// Feature flags por rol
const FEATURES_BY_ROLE: Record<Role, string[]> = {
  admin: ["rubros", "pipelines", "estados", "ia", "roles"],
  editor: ["rubros", "pipelines", "estados"],
  viewer: ["rubros"],
};

function hasFeature(feature: string): boolean {
  return FEATURES_BY_ROLE[currentRole]?.includes(feature) ?? false;
}

type SidebarItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isSubItem?: boolean;
};

type ConfigSubItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  feature: string;
  placeholder?: boolean; // Si es true, la ruta puede no existir todavía
};

// Componente normalizado para items del menú
function SidebarItem({ label, href, icon: Icon, isActive = false }: Omit<SidebarItem, 'isSubItem'> & { isActive: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2 rounded-md px-4 py-2 text-sm transition",
        isActive
          ? "bg-white/10 text-white"
          : "text-slate-300 hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      <Icon 
        className="w-4 h-4 shrink-0" 
        aria-hidden="true"
      />
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [configOpen, setConfigOpen] = useState(false);
  const [portalName, setPortalName] = useState("Cámara Costa");

  // Cargar nombre del portal desde la configuración
  useEffect(() => {
    async function loadPortalName() {
      try {
        const res = await fetch("/api/admin/config/portal", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const json = await res.json();
        if (json?.data?.titulo_header) {
          setPortalName(json.data.titulo_header);
        } else if (json?.data?.nombre_camara) {
          setPortalName(json.data.nombre_camara);
        }
      } catch {
        // Fallback a "Cámara Costa" si falla
      }
    }
    loadPortalName();

    // Escuchar eventos de actualización
    const handleUpdate = () => loadPortalName();
    window.addEventListener("portal-config-updated", handleUpdate);
    return () => window.removeEventListener("portal-config-updated", handleUpdate);
  }, []);

  // Detectar si estamos en una ruta de configuración para mantener el submenú abierto
  useEffect(() => {
    const isConfigRoute =
      pathname === "/admin/configuracion" ||
      pathname.startsWith("/admin/configuracion/") ||
      pathname === "/admin/rubros" ||
      pathname.startsWith("/admin/rubros/");
    setConfigOpen(isConfigRoute);
  }, [pathname]);

  const items: SidebarItem[] = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Empresas", href: "/admin/empresas", icon: Building2 },
    { label: "Leads", href: "/admin/leads", icon: Target },
    { label: "Socios", href: "/admin/socios", icon: Users },
    { label: "Reportes", href: "/admin/reportes", icon: BarChart3 },
    { label: "Eventos", href: "/admin/eventos", icon: CalendarDays },
    { label: "IA", href: "/admin/configuracion/ia", icon: Sparkles },
  ];

  // Submenú de Configuración (orden lógico) - sin IA
  const configSubItems: ConfigSubItem[] = [
    { 
      label: "Rubros", 
      href: "/admin/rubros", 
      icon: FolderTree, 
      feature: "rubros" 
    },
    { 
      label: "Pipelines", 
      href: "/admin/configuracion/pipelines", 
      icon: GitBranch, 
      feature: "pipelines",
      placeholder: true // TODO: Crear página cuando esté listo
    },
    { 
      label: "Estados", 
      href: "/admin/configuracion/estados", 
      icon: CheckSquare, 
      feature: "estados",
      placeholder: true // TODO: Crear página cuando esté listo
    },
    { 
      label: "Roles", 
      href: "/admin/configuracion/roles", 
      icon: Users, 
      feature: "roles",
      placeholder: true // TODO: Crear página cuando esté listo
    },
  ];

  // Filtrar items por feature flags
  const visibleConfigSubItems = configSubItems.filter((item) => hasFeature(item.feature));

  const isConfigActive =
    pathname === "/admin/configuracion" ||
    pathname.startsWith("/admin/configuracion/");

  const isConfigSubItemActive = (href: string) => {
    return pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));
  };

  return (
    <aside className="h-screen bg-slate-900 text-slate-200 flex flex-col">
      
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <div className="font-bold text-lg text-white">
          {portalName}
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((it) => {
          const active =
            pathname === it.href ||
            (it.href !== "/admin" && pathname.startsWith(it.href + "/"));
          return (
            <SidebarItem
              key={it.href}
              label={it.label}
              href={it.href}
              icon={it.icon}
              isActive={active}
            />
          );
        })}

        {/* Configuración con submenú */}
        <div>
          <div
            className={[
              "w-full flex items-center justify-between rounded-md px-4 py-2 text-sm transition",
              isConfigActive
                ? "bg-white/10 text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white",
            ].join(" ")}
          >
            <Link
              href="/admin/configuracion"
              className="flex items-center gap-2 flex-1"
            >
              <SettingsIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Configuración</span>
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfigOpen(!configOpen);
              }}
              className={[
                "transition-transform text-xs hover:opacity-80 ml-2",
                configOpen ? "rotate-90" : ""
              ].join(" ")}
            >
              ▶
            </button>
          </div>

          {configOpen && (
            <div className="ml-4 mt-1 space-y-1">
              {visibleConfigSubItems.map((subItem) => {
                const active = isConfigSubItemActive(subItem.href);
                return (
                  <div key={subItem.href} className="relative">
                    <Link
                      href={subItem.href}
                      className={[
                        "flex items-center gap-2 rounded-md px-4 py-2 text-sm transition",
                        active
                          ? "bg-white/10 text-white"
                          : "text-slate-300 hover:bg-white/5 hover:text-white",
                      ].join(" ")}
                      title={subItem.placeholder ? "Próximamente" : undefined}
                    >
                      <subItem.icon 
                        className="w-4 h-4 shrink-0" 
                        aria-hidden="true"
                      />
                      <span>{subItem.label}</span>
                      {subItem.placeholder && (
                        <span className="ml-auto text-xs text-slate-500">(próximo)</span>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 text-xs text-slate-400">
        Admin Cámara<br />
        v1.0
      </div>
    </aside>
  );
}