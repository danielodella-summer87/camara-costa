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
  CalendarDays,
  SlidersHorizontal,
  Calendar
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
  const [portalName, setPortalName] = useState("Cámara Costa");
  const [memberLabel, setMemberLabel] = useState("Socios");

  // Cargar nombre del portal y labels desde la configuración
  useEffect(() => {
    async function loadConfig() {
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
        
        // Cargar label de miembros
        if (json?.data?.label_member_plural) {
          setMemberLabel(json.data.label_member_plural);
        }
      } catch {
        // Fallback a defaults si falla
      }
    }
    loadConfig();

    // Escuchar eventos de actualización
    const handleUpdate = () => loadConfig();
    window.addEventListener("portal-config-updated", handleUpdate);
    return () => window.removeEventListener("portal-config-updated", handleUpdate);
  }, []);

  const items: SidebarItem[] = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Entidades", href: "/admin/empresas", icon: Building2 },
    { label: "Leads", href: "/admin/leads", icon: Target },
    { label: memberLabel, href: "/admin/socios", icon: Users },
    { label: "Agenda", href: "/admin/agenda", icon: Calendar },
    { label: "Reportes", href: "/admin/reportes", icon: BarChart3 },
    { label: "Eventos", href: "/admin/eventos", icon: CalendarDays },
    { label: "IA", href: "/admin/configuracion/ia", icon: Sparkles },
    { label: "Personalización", href: "/admin/personalizacion", icon: SlidersHorizontal },
    { label: "Configuración", href: "/admin/configuracion", icon: SettingsIcon },
  ];

  return (
    <aside className="h-screen bg-slate-900 text-slate-200 flex flex-col">
      
      {/* Header (Título + Logo) */}
      <div className="px-4 pt-4 pb-3 text-center border-b border-white/10">
        <div className="text-sm font-semibold text-white mb-3">
          {portalName}
        </div>
        <div className="flex justify-center">
          <div className="h-20 w-20 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <img
              src="/licencia.png"
              alt="Logo Licenciatario"
              className="h-20 w-20 object-contain"
            />
          </div>
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
      </nav>

      {/* Footer */}
      <div className="flex flex-col items-center justify-center gap-2 py-4 border-t border-white/10">
        <img
          src="/summer87.png"
          alt="SUMMER87"
          className="h-16 w-auto object-contain"
        />

        <div className="text-xs font-semibold tracking-wide text-white">
          SUMMER87.AI
        </div>

        <div className="text-[10px] text-slate-300">
          2026
        </div>
      </div>
    </aside>
  );
}