"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

type Permission = {
  id: string;
  key?: string;
  module?: string;
  action?: string;
  description?: string | null;
  label?: string;
  category?: string;
};

type Role = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  is_system?: boolean;
  permissions: Permission[];
};

type RolesData = {
  roles: Role[];
  allPermissions: Permission[];
};

function permDisplay(p: Permission): string {
  return p.label ?? p.key ?? p.id;
}

export default function RolesPermisosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RolesData | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/config/roles", {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Error cargando roles");
        setData(json.data ?? null);
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
              <h1 className="text-2xl font-semibold text-slate-900">Roles y permisos</h1>
              <p className="mt-1 text-sm text-slate-600">
                Roles del sistema y permisos asignados a cada uno. Solo lectura.
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
          <div className="text-sm text-slate-500">Cargando roles…</div>
        ) : data?.roles?.length ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Roles del sistema</h2>
            {data.roles.map((role) => (
              <div
                key={role.id}
                className="rounded-2xl border bg-white p-6"
              >
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{role.label}</span>
                    <span className="text-xs text-slate-500">({role.name})</span>
                    {role.is_system && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        sistema
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="mt-1 text-sm text-slate-600">{role.description}</p>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">
                    Permisos asignados
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {role.permissions?.length ? (
                      role.permissions.map((p) => (
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
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
            No hay roles para mostrar.
          </div>
        )}
      </div>
    </PageContainer>
  );
}
