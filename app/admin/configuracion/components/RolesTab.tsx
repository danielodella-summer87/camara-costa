"use client";

import { useEffect, useState } from "react";

type Permission = {
  id: string;
  key: string;
  module: string;
  action: string;
  description: string | null;
};

type Role = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  is_system: boolean;
  permissions: Permission[];
};

type RolesData = {
  roles: Role[];
  allPermissions: Permission[];
};

export default function RolesTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RolesData | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Cargar roles y permisos
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/config/roles", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Error cargando roles");
        setData(json.data);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Cuando se selecciona un rol, cargar sus permisos
  useEffect(() => {
    if (selectedRole) {
      const permIds = new Set(selectedRole.permissions.map((p) => p.id));
      setSelectedPermissions(permIds);
    } else {
      setSelectedPermissions(new Set());
    }
  }, [selectedRole]);

  // Agrupar permisos por módulo
  const permissionsByModule = data
    ? data.allPermissions.reduce((acc, perm) => {
        if (!acc[perm.module]) {
          acc[perm.module] = [];
        }
        acc[perm.module].push(perm);
        return acc;
      }, {} as Record<string, Permission[]>)
    : {};

  const modules = Object.keys(permissionsByModule).sort();

  // Guardar cambios de permisos
  async function savePermissions() {
    if (!selectedRole) return;

    setSaving(true);
    setError(null);
    try {
      const permissionIds = Array.from(selectedPermissions);
      const res = await fetch("/api/admin/config/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRole.id,
          permissionIds,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error guardando permisos");

      // Recargar datos
      const refreshRes = await fetch("/api/admin/config/roles", {
        cache: "no-store",
      });
      const refreshJson = await refreshRes.json();
      if (refreshRes.ok && refreshJson.data) {
        setData(refreshJson.data);
        // Actualizar rol seleccionado
        const updatedRole = refreshJson.data.roles.find(
          (r: Role) => r.id === selectedRole.id
        );
        if (updatedRole) {
          setSelectedRole(updatedRole);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Error guardando permisos");
    } finally {
      setSaving(false);
    }
  }

  // Toggle permiso
  function togglePermission(permissionId: string) {
    const newSet = new Set(selectedPermissions);
    if (newSet.has(permissionId)) {
      newSet.delete(permissionId);
    } else {
      newSet.add(permissionId);
    }
    setSelectedPermissions(newSet);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="text-center text-slate-600">Cargando roles...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Roles y Permisos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Administrá los roles del sistema y sus permisos asociados.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Lista de roles */}
          <div>
            <div className="mb-3 text-sm font-semibold text-slate-700">Roles</div>
            <div className="space-y-2">
              {data?.roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedRole?.id === role.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{role.label}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {role.name}
                        {role.is_system && (
                          <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px]">
                            Sistema
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <div className="mt-1 text-xs text-slate-600">{role.description}</div>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {role.permissions.length} permisos
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Editor de permisos */}
          <div>
            {selectedRole ? (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">
                      Permisos: {selectedRole.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      {selectedPermissions.size} de {data?.allPermissions.length} seleccionados
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={savePermissions}
                    disabled={saving}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>

                <div className="max-h-[600px] space-y-4 overflow-y-auto rounded-xl border bg-slate-50 p-4">
                  {modules.map((module) => (
                    <div key={module} className="space-y-2">
                      <div className="text-sm font-semibold text-slate-700 uppercase">
                        {module}
                      </div>
                      <div className="space-y-1">
                        {permissionsByModule[module].map((perm) => {
                          const isChecked = selectedPermissions.has(perm.id);
                          return (
                            <label
                              key={perm.id}
                              className="flex items-start gap-2 rounded border bg-white p-2 hover:bg-slate-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(perm.id)}
                                className="mt-0.5 rounded border-slate-300"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900">
                                  {perm.key}
                                </div>
                                {perm.description && (
                                  <div className="text-xs text-slate-600">{perm.description}</div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-slate-50 p-6 text-center text-slate-600">
                Seleccioná un rol para editar sus permisos
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
