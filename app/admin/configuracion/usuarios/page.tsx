"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

type Permission = {
  id: string;
  key?: string;
  label?: string;
};

type Role = {
  id: string;
  name: string;
  label: string;
  permissions?: Permission[];
};

type User = {
  id: string;
  nombre: string;
  email: string;
  is_active?: boolean;
  role_id: string;
  roles?: { id: string; name: string; label: string } | null;
};

function permDisplay(p: Permission): string {
  return p.label ?? p.key ?? p.id;
}

export default function UsuariosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rolesWithPerms, setRolesWithPerms] = useState<Record<string, Permission[]>>({});

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [usersRes, rolesRes] = await Promise.all([
          fetch("/api/admin/config/usuarios", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/admin/config/roles", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const usersJson = await usersRes.json();
        const rolesJson = await rolesRes.json();

        if (!usersRes.ok) throw new Error(usersJson?.error ?? "Error cargando usuarios");
        if (!rolesRes.ok) throw new Error(rolesJson?.error ?? "Error cargando roles");

        const userList: User[] = usersJson.data ?? [];
        setUsers(userList);

        const roles: Role[] = rolesJson.data?.roles ?? [];
        const map: Record<string, Permission[]> = {};
        for (const r of roles) {
          map[r.id] = r.permissions ?? [];
        }
        setRolesWithPerms(map);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Usuarios y roles</h1>
              <p className="mt-1 text-sm text-slate-600">
                Listado de usuarios, rol asignado y permisos efectivos (derivados del rol). Solo lectura.
              </p>
            </div>
            <Link
              href="/admin/configuracion"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Volver
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-500">Cargando usuarios…</div>
        ) : users.length ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Usuarios</h2>
            {users.map((user) => {
              const roleLabel = user.roles?.label ?? user.roles?.name ?? "—";
              const roleId = user.role_id ?? user.roles?.id;
              const effectivePerms = roleId ? rolesWithPerms[roleId] ?? [] : [];

              return (
                <div
                  key={user.id}
                  className="rounded-2xl border bg-white p-6"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{user.nombre}</span>
                    <span className="text-sm text-slate-600">{user.email}</span>
                    {user.is_active === false && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        inactivo
                      </span>
                    )}
                  </div>
                  <div className="mb-3">
                    <span className="text-sm font-medium text-slate-700">Rol: </span>
                    <span className="text-sm text-slate-600">{roleLabel}</span>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">
                      Permisos efectivos (por rol)
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                      {effectivePerms.length ? (
                        effectivePerms.map((p) => (
                          <li
                            key={p.id}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-700"
                          >
                            {permDisplay(p)}
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-slate-500">Ninguno</li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
            No hay usuarios para mostrar.
          </div>
        )}
      </div>
    </PageContainer>
  );
}
