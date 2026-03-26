"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  DEFAULT_ADMIN_SIDEBAR_MODULES,
  mergeAdminSidebarModules,
  type AdminSidebarModule,
  type SidebarModuleStatus,
} from "@/lib/admin/adminSidebarModules";

const STATUS_OPTIONS: { value: SidebarModuleStatus; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "en_preparacion", label: "En preparación" },
  { value: "oculto", label: "Oculto" },
];

export default function ModulosMenuPage() {
  const [rows, setRows] = useState<AdminSidebarModule[]>(() => mergeAdminSidebarModules(undefined));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config/portal", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = (await res.json()) as { data?: { sidebar_modules?: unknown } };
      if (!res.ok) throw new Error("No se pudo cargar la configuración");
      setRows(mergeAdminSidebarModules(json.data?.sidebar_modules as never));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setRows(mergeAdminSidebarModules(undefined));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setError(null);
    setSaving(true);
    setSuccess(false);
    try {
      const payload = rows.map((r) => ({
        key: r.key,
        icon: r.icon,
        status: r.status,
        ...(r.useMemberPluralLabel ? {} : { label: r.label }),
      }));
      const res = await fetch("/api/admin/config/portal", {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ sidebar_modules: payload }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json?.error ?? "Error al guardar");
      setSuccess(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("portal-config-updated"));
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function updateRow(key: string, patch: Partial<Pick<AdminSidebarModule, "label" | "icon" | "status">>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/admin/configuracion" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                ← Configuración
              </Link>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Módulos y menú</h1>
              <p className="mt-1 text-sm text-slate-600">
                Estado visual del menú lateral, icono y visibilidad. Se guarda en la misma configuración del portal (
                <code className="rounded bg-slate-100 px-1 text-xs">config</code> ·{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">portal_config</code> ·{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">sidebar_modules</code>).
              </p>
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || loading}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Cambios guardados. El menú se actualizará al instante en esta sesión.
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border bg-white">
          {loading ? (
            <p className="p-6 text-sm text-slate-600">Cargando módulos…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Icono</th>
                    <th className="px-4 py-3">Nombre en menú</th>
                    <th className="px-4 py-3">Ruta</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={r.icon}
                          onChange={(e) => updateRow(r.key, { icon: e.target.value })}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-lg"
                          maxLength={32}
                          aria-label={`Icono ${r.label}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {r.useMemberPluralLabel ? (
                          <div>
                            <p className="font-medium text-slate-400">(Personalización · plural)</p>
                            <p className="text-xs text-slate-500">
                              El texto visible lo define Cliente / Clientes en Personalización, no este campo.
                            </p>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={r.label}
                            onChange={(e) => updateRow(r.key, { label: e.target.value })}
                            className="w-full max-w-xs rounded-lg border border-slate-200 px-2 py-1.5"
                            maxLength={120}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-slate-700">{r.href}</code>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={r.status}
                          onChange={(e) => updateRow(r.key, { status: e.target.value as SidebarModuleStatus })}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-800"
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Referencia de claves internas: {DEFAULT_ADMIN_SIDEBAR_MODULES.map((m) => m.key).join(", ")}.
        </p>
      </div>
    </PageContainer>
  );
}
