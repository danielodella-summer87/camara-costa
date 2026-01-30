"use client";

import { useEffect, useState } from "react";

/**
 * Hook para obtener permisos del usuario activo (cookie x-user-id o fallback).
 * Hace fetch a /api/admin/permissions/me y expone can(key).
 *
 * Uso:
 * ```tsx
 * const { can, permissions, loading } = usePermissions();
 * if (can("leads.create")) return <button>Crear Lead</button>;
 * ```
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/permissions/me")
      .then((r) => r.json())
      .then((j) => {
        setPermissions(j?.data ?? []);
      })
      .catch(() => setPermissions([]))
      .finally(() => setLoading(false));
  }, []);

  const can = (key: string) => permissions.includes(key);

  return {
    can,
    /** Alias de can() para compatibilidad con código existente */
    hasPermission: can,
    permissions,
    loading,
  };
}
