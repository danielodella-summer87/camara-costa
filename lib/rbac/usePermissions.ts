"use client";

import { useEffect, useState } from "react";
import { hasPermission as rbacHasPermission } from "@/app/lib/rbac";

type MeResponse = {
  user?: { role?: string | null };
  data?: string[];
  role?: string | null;
  error?: string | null;
};

/**
 * Hook para obtener permisos del usuario activo (cookie x-user-id o fallback).
 * Hace fetch a /api/admin/permissions/me y expone hasPermission(key) usando
 * RBAC por rol (app/lib/rbac). Si hay rol, se usa el mapa de permisos por rol;
 * si no, se usa la lista de permisos devuelta por la API.
 *
 * Uso:
 * ```tsx
 * const { hasPermission, role, loading } = usePermissions();
 * if (hasPermission("leads.write")) return <button>Nuevo Lead</button>;
 * if (hasPermission("admin")) return <button>Eliminar</button>;
 * ```
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/permissions/me")
      .then((r) => r.json())
      .then((j: MeResponse) => {
        setPermissions(j?.data ?? []);
        setRole(j?.user?.role ?? j?.role ?? null);
      })
      .catch(() => {
        setPermissions([]);
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const hasPermission = (key: string) =>
    rbacHasPermission(role, key) || permissions.includes(key);

  return {
    hasPermission,
    /** Alias para compatibilidad */
    can: hasPermission,
    permissions,
    role,
    loading,
  };
}
