"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type ConfigResponse = {
  prompt_base?: string;
  error?: string;
};

export default function ConfiguracionPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [promptBase, setPromptBase] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
  }, []);

  async function fetchConfig() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config/leads", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ConfigResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando configuración");

      setPromptBase(json?.prompt_base ?? "");
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
      const res = await fetch("/api/admin/config/leads", {
        method: "PUT",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ prompt_base: promptBase }),
      });

      const json = (await res.json()) as ConfigResponse;
      if (!res.ok) {
        throw new Error(json?.error ?? "Error guardando configuración");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
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
              <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
              <p className="mt-1 text-sm text-slate-600">
                Ajustes del sistema y configuración de IA.
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

        {/* Sección IA / Leads */}
        <div className="rounded-2xl border bg-white p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">IA / Leads</h2>
            <p className="mt-1 text-sm text-slate-600">
              Configura el prompt base que se usará para generar informes de IA de leads.
              Este prompt se combinará con datos específicos del lead y cualquier personalización adicional.
            </p>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Cargando configuración…</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Prompt base IA (Leads)
                </label>
                <textarea
                  value={promptBase}
                  onChange={(e) => {
                    setPromptBase(e.target.value);
                    setSuccess(false);
                  }}
                  rows={12}
                  placeholder="Ej: Actuás como Director de Desarrollo Institucional..."
                  className="w-full rounded-xl border px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={saving}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Este prompt se usará como base para todos los informes de IA. Puedes dejarlo vacío si prefieres usar solo el prompt por defecto.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={fetchConfig}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  disabled={saving || loading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={saving || loading}
                  className="rounded-xl border bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{saving ? "Guardando…" : "Guardar"}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sección de sesión (mantener la existente) */}
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Sesión</h2>
          <p className="text-sm text-slate-600">
            Sesión actual: {email ?? "Sin sesión"}
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
