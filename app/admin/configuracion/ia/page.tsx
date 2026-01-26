"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";

const STORAGE_KEY = "camara_costa_ai_prompts_v1";

type PromptConfig = {
  base: string;
  modules: Record<string, string>;
};

const DEFAULT_MODULES: Record<string, string> = {
  INVESTIGACION_DIGITAL: "Genera un análisis de investigación digital: presencia web, SEO, contenido, autoridad digital. Responde SOLO con el contenido del análisis, sin introducciones ni títulos adicionales.",
  REDES_SOCIALES: "Genera un análisis de redes sociales: presencia, engagement, estrategia de contenido, audiencia. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.",
  PAUTA_PUBLICITARIA: "Genera un análisis de pauta publicitaria: inversión, canales, mensajes, ROI potencial. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.",
  PRESTIGIO_IA: "Genera un análisis de prestigio usando IA: reputación, menciones, reviews, señales de calidad. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.",
  POSICIONAMIENTO: "Genera un análisis de posicionamiento: mercado, diferenciación, propuesta de valor, competencia. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.",
  COMPETENCIA: "Genera un análisis de competencia: competidores directos, ventajas competitivas, amenazas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.",
  FODA: "Genera un análisis FODA completo con: Fortalezas, Oportunidades, Debilidades y Amenazas. Responde SOLO con el contenido del análisis, sin introducciones ni títulos adicionales.",
  OPORTUNIDADES: "Genera un análisis de oportunidades con subsecciones: Oportunidades visibles, Oportunidades ocultas, Anticipación, Mejoras no pedidas, Tácticas inesperadas. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.",
  ACCIONES: "Genera un plan de acciones con subsecciones: Acciones 72 hs, Plan 30–90 días. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.",
  MATERIALES_LISTOS: "Genera una lista de materiales listos para usar: Copys, Scripts, PDFs, Recursos accionables. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.",
  CIERRE_VENTA: "Genera estrategias de cierre de venta: argumentos, objeciones, CTAs, próximos pasos. Responde SOLO con el contenido, sin introducciones ni títulos adicionales.",
};

const DEFAULT_BASE = `Eres un consultor senior experto en identificar oportunidades estratégicas. Generas informes técnicos con enfoque en decisiones, hipótesis accionables, señales y riesgos. Tono directo, sin relleno, consultivo senior.

REGLAS ESTRICTAS:
- No mencionar Cámara / asociación / institución salvo que el lead sea explícitamente una Cámara.
- No asumir contexto institucional si no está explícitamente indicado en los datos del lead.`;

const MODULE_LABELS: Record<string, string> = {
  INVESTIGACION_DIGITAL: "Investigación Digital",
  REDES_SOCIALES: "Redes Sociales",
  PAUTA_PUBLICITARIA: "Pauta Publicitaria",
  PRESTIGIO_IA: "Prestigio IA",
  POSICIONAMIENTO: "Posicionamiento",
  COMPETENCIA: "Competencia",
  FODA: "FODA",
  OPORTUNIDADES: "Oportunidades",
  ACCIONES: "Acciones",
  MATERIALES_LISTOS: "Materiales Listos",
  CIERRE_VENTA: "Cierre de Venta",
};

export default function ConfigIAPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [config, setConfig] = useState<PromptConfig>({
    base: "",
    modules: {},
  });

  function loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PromptConfig;
        setConfig({
          base: parsed.base || DEFAULT_BASE,
          modules: { ...DEFAULT_MODULES, ...(parsed.modules || {}) },
        });
      } else {
        setConfig({
          base: DEFAULT_BASE,
          modules: { ...DEFAULT_MODULES },
        });
      }
    } catch (e) {
      console.error("Error cargando configuración:", e);
      setConfig({
        base: DEFAULT_BASE,
        modules: { ...DEFAULT_MODULES },
      });
    } finally {
      setLoading(false);
    }
  }

  function saveConfig() {
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? "Error guardando configuración");
    } finally {
      setSaving(false);
    }
  }

  function restoreDefaults() {
    if (!window.confirm("¿Restaurar prompts por defecto? Se perderán los cambios no guardados.")) {
      return;
    }

    setConfig({
      base: DEFAULT_BASE,
      modules: { ...DEFAULT_MODULES },
    });
    setSuccess(false);
    setError(null);
  }

  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Configuración · IA</h1>
              <p className="mt-1 text-sm text-slate-600">
                Configura los prompts base y por módulo que se usarán para generar informes de IA de leads.
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

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Configuración guardada correctamente.
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-500">Cargando configuración…</div>
        ) : (
          <div className="space-y-6">
            {/* Prompt Base */}
            <div className="rounded-2xl border bg-white p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Prompt Base</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Este prompt se usará como contexto base para todos los módulos.
                </p>
              </div>

              <textarea
                value={config.base}
                onChange={(e) => {
                  setConfig((prev) => ({ ...prev, base: e.target.value }));
                  setSuccess(false);
                }}
                rows={10}
                placeholder="Prompt base..."
                className="w-full rounded-xl border px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={saving}
              />
            </div>

            {/* Módulos */}
            <div className="rounded-2xl border bg-white p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Prompts por Módulo</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Configura el prompt específico para cada módulo del informe.
                </p>
              </div>

              <div className="space-y-6">
                {Object.entries(MODULE_LABELS).map(([moduleId, label]) => (
                  <div key={moduleId}>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {label}
                    </label>
                    <textarea
                      value={config.modules[moduleId] || DEFAULT_MODULES[moduleId] || ""}
                      onChange={(e) => {
                        setConfig((prev) => ({
                          ...prev,
                          modules: { ...prev.modules, [moduleId]: e.target.value },
                        }));
                        setSuccess(false);
                      }}
                      rows={4}
                      placeholder={`Prompt para ${label}...`}
                      className="w-full rounded-xl border px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      disabled={saving}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={restoreDefaults}
                className="rounded-xl border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving}
              >
                Restaurar defaults
              </button>
              <button
                type="button"
                onClick={saveConfig}
                disabled={saving}
                className="rounded-xl border bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
