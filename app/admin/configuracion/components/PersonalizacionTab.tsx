"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LABELS, getLabels } from "@/lib/labels";

type ApiResp = {
  data?: {
    label_member_singular?: string | null;
    label_member_plural?: string | null;
    [key: string]: any;
  };
  error?: string | null;
};

export default function PersonalizacionTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [singular, setSingular] = useState<string>(DEFAULT_LABELS.memberSingular);
  const [plural, setPlural] = useState<string>(DEFAULT_LABELS.memberPlural);

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

      const labels = getLabels(json?.data);
      setSingular(labels.memberSingular);
      setPlural(labels.memberPlural);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando configuración");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!singular.trim() || !plural.trim()) {
      setError("Ambos campos son obligatorios");
      return;
    }

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
          label_member_singular: singular.trim(),
          label_member_plural: plural.trim(),
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

  function restoreDefaults() {
    setSingular(DEFAULT_LABELS.memberSingular);
    setPlural(DEFAULT_LABELS.memberPlural);
    setError(null);
  }

  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Personalización</h2>
            <p className="mt-1 text-xs text-slate-600">
              Definí cómo se llaman los "socios" en tu sistema.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          ✓ Configuración guardada correctamente. Los cambios se reflejarán en toda la aplicación.
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Cargando...</div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                Nombre en singular *
              </label>
              <input
                type="text"
                value={singular}
                onChange={(e) => setSingular(e.target.value)}
                placeholder={DEFAULT_LABELS.memberSingular}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                disabled={saving}
              />
              <p className="mt-1 text-xs text-slate-500">
                Ejemplo: "Socio", "Cliente", "Abonado"
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                Nombre en plural *
              </label>
              <input
                type="text"
                value={plural}
                onChange={(e) => setPlural(e.target.value)}
                placeholder={DEFAULT_LABELS.memberPlural}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                disabled={saving}
              />
              <p className="mt-1 text-xs text-slate-500">
                Ejemplo: "Socios", "Clientes", "Abonados"
              </p>
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">Vista previa:</p>
              <div className="space-y-1 text-sm text-slate-700">
                <p>• Menú: "<span className="font-semibold">{plural}</span>"</p>
                <p>• Botón: "Convertir en <span className="font-semibold">{singular.toLowerCase()}</span>"</p>
                <p>• Confirmación: "¿Convertir este lead en <span className="font-semibold">{singular.toLowerCase()}</span>?"</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={restoreDefaults}
                disabled={saving || loading}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Restaurar por defecto
              </button>
              <button
                type="button"
                onClick={saveConfig}
                disabled={saving || loading || !singular.trim() || !plural.trim()}
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
