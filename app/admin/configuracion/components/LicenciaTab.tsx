"use client";

import { useEffect, useState } from "react";

type ApiResp = {
  data?: {
    titulo_header?: string | null;
    nombre_camara?: string | null;
    [key: string]: any;
  };
  error?: string | null;
};

export default function LicenciaTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [tituloHeader, setTituloHeader] = useState("");

  async function loadConfig() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config/portal", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = (await res.json()) as ApiResp;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando configuración");

      // Precargar con titulo_header o nombre_camara como fallback
      const value = json?.data?.titulo_header ?? json?.data?.nombre_camara ?? "";
      setTituloHeader(value);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando configuración");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setError(null);
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/config/portal", {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          titulo_header: tituloHeader.trim() || null,
        }),
      });

      const json = (await res.json()) as ApiResp;
      if (!res.ok) throw new Error(json?.error ?? "Error guardando configuración");

      setSuccess(true);
      
      // Disparar evento para que otros componentes se actualicen
      window.dispatchEvent(new CustomEvent("portal-config-updated"));
      
      // Ocultar mensaje después de 3 segundos
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? "Error guardando configuración");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          ✓ Guardado
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Cargando...</div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                Nombre del licenciatario
              </label>
              <input
                type="text"
                value={tituloHeader}
                onChange={(e) => setTituloHeader(e.target.value)}
                placeholder="Ej: Cámara Costa"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                disabled={saving}
              />
              <p className="mt-1 text-xs text-slate-500">
                Este texto aparece arriba del logo en el menú lateral.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={saveConfig}
                disabled={saving || loading}
                className="rounded-xl border bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
