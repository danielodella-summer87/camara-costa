"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";

type PortalConfig = {
  nombre_camara?: string;
  moneda?: "USD" | "UYU";
  timezone?: string;
  titulo_header?: string | null;
  logo_url?: string | null;
};

type ConfigResponse = {
  data?: PortalConfig;
  error?: string;
};

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [config, setConfig] = useState<PortalConfig>({
    nombre_camara: "Cámara Costa",
    moneda: "USD",
    timezone: "America/Montevideo",
    titulo_header: null,
    logo_url: null,
  });

  async function fetchConfig() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config/portal", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ConfigResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando configuración");

      if (json.data) {
        setConfig(json.data);
      }
    } catch (e: any) {
      setError(e?.message ?? "Error cargando configuración");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/config/portal", {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(config),
      });

      const json = (await res.json()) as ConfigResponse;
      if (!res.ok) {
        throw new Error(json?.error ?? "Error guardando configuración");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Forzar recarga del título en el header/sidebar
      window.dispatchEvent(new Event("portal-config-updated"));
    } catch (e: any) {
      setError(e?.message ?? "Error guardando configuración");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Configuración del Portal</h1>
              <p className="mt-1 text-sm text-slate-600">
                Ajustes generales del portal y personalización.
              </p>
            </div>

            <Link
              href="/admin"
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

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Configuración guardada correctamente.
          </div>
        )}

        {/* Sección Configuración del Portal */}
        <div className="rounded-2xl border bg-white p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Configuración General</h2>
            <p className="mt-1 text-sm text-slate-600">
              Personaliza el nombre, moneda y otros parámetros del portal.
            </p>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Cargando configuración…</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Nombre de la Cámara *
                </label>
                <input
                  type="text"
                  value={config.nombre_camara ?? ""}
                  onChange={(e) => setConfig({ ...config, nombre_camara: e.target.value })}
                  placeholder="Ej: Cámara Costa"
                  className="w-full rounded-xl border px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Este nombre se mostrará en el título superior del portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Título del Header (opcional)
                </label>
                <input
                  type="text"
                  value={config.titulo_header ?? ""}
                  onChange={(e) => setConfig({ ...config, titulo_header: e.target.value || null })}
                  placeholder="Dejar vacío para usar el nombre de la cámara"
                  className="w-full rounded-xl border px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Si se especifica, este título se mostrará en lugar del nombre de la cámara en el header.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Moneda *
                </label>
                <select
                  value={config.moneda ?? "USD"}
                  onChange={(e) => setConfig({ ...config, moneda: e.target.value as "USD" | "UYU" })}
                  className="w-full rounded-xl border px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={saving}
                >
                  <option value="USD">USD (Dólares)</option>
                  <option value="UYU">UYU (Pesos Uruguayos)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Zona Horaria *
                </label>
                <input
                  type="text"
                  value={config.timezone ?? "America/Montevideo"}
                  onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                  placeholder="America/Montevideo"
                  className="w-full rounded-xl border px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Formato IANA timezone (ej: America/Montevideo, America/New_York).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  URL del Logo (opcional)
                </label>
                <input
                  type="url"
                  value={config.logo_url ?? ""}
                  onChange={(e) => setConfig({ ...config, logo_url: e.target.value || null })}
                  placeholder="https://ejemplo.com/logo.png"
                  className="w-full rounded-xl border px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-slate-500">
                  URL completa de la imagen del logo del portal.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={fetchConfig}
                  disabled={saving || loading}
                  className="px-6 py-2 rounded-full bg-green-200 text-black font-medium hover:bg-green-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={saving || loading}
                  className="px-6 py-2 rounded-full bg-green-200 text-black font-medium hover:bg-green-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
