"use client";

import { useEffect, useState, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";

console.log("[IA CONFIG] PAGE.TSX HIT", new Date().toISOString());

const STORAGE_KEY = "camara_costa_ai_prompts_v1";
const API_IA = "/api/admin/config/ia";

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
  vision_estrategica: `Actúa como Director de Growth Marketing Senior y socio estratégico.

Tu tarea NO es analizar módulos por separado ni repetir diagnósticos.
Tu tarea es integrar todo el informe previo y producir una lectura estratégica unificada.

Objetivo:
Convertir el informe técnico en una visión clara para la toma de decisiones.

Instrucciones obligatorias:
- No repitas información descriptiva ya mencionada.
- No enumeres herramientas ni tácticas menores.
- Prioriza impacto de negocio sobre exhaustividad.
- Toma postura profesional, incluso si implica descartar opciones.
- Pensá como si tu reputación dependiera de esta recomendación.

Desarrolla los siguientes bloques, en este orden y solo con el contenido solicitado:

1. LECTURA CENTRAL  
2. PALANCA ESTRATÉGICA DOMINANTE  
3. FOCO RECOMENDADO  
4. RIESGO CLAVE  
5. DECISIÓN SUGERIDA  
6. PRÓXIMO MOVIMIENTO INTELIGENTE  

Reglas finales:
- Sé claro, directo y sintético.
- Evita lenguaje genérico o académico.
- No vendas servicios.
- No cierres con frases abiertas.`,
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
  vision_estrategica: "Visión Estratégica",
};

/**
 * Carga desde backend o storage SIN reemplazar con defaults.
 * El valor guardado en DB/storage es la única fuente de verdad.
 */
function parseStored(parsed: { base?: string; modules?: Record<string, string> }): PromptConfig {
  return {
    base: typeof parsed?.base === "string" ? parsed.base : "",
    modules: parsed?.modules && typeof parsed.modules === "object" && !Array.isArray(parsed.modules)
      ? parsed.modules
      : {},
  };
}

function loadFromStorage(): PromptConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PromptConfig;
      return parseStored(parsed);
    }
  } catch (e) {
    console.error("Error leyendo localStorage:", e);
  }
  return { base: "", modules: {} };
}

function saveToStorage(config: PromptConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Error guardando en localStorage:", e);
  }
}

export default function ConfigIAPage() {
  console.log("[IA CONFIG] RENDER");
  console.log("[IA CONFIG] componente renderizado");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [backendWarning, setBackendWarning] = useState<string | null>(null);
  const [config, setConfig] = useState<PromptConfig>({
    base: "",
    modules: {},
  });

  const loadFromBackend = useCallback(async () => {
    try {
      console.log("[IA CONFIG] voy a hacer fetch a /api/admin/config/ia");
      const res = await fetch(API_IA, { credentials: "include" });
      console.log("[IA CONFIG] respuesta fetch", res.status);
      const json = await res.json().catch(() => ({}));
      console.log("[IA CONFIG] payload backend", json);

      if (!res.ok) {
        setBackendWarning("No se pudo cargar la configuración del servidor. Se usa la copia local.");
        setConfig(loadFromStorage());
        return;
      }

      if (json.data && (json.data.basePrompt !== undefined || json.data.modulos !== undefined)) {
        const payload = json.data;
        const next = parseStored({
          base: payload.basePrompt,
          modules: payload.modulos,
        });
        console.log("[IA CONFIG] Loaded:", { prompt_base: next.base, modules: Object.keys(next.modules) });
        setConfig(next);
        saveToStorage(next);
      } else {
        setConfig(loadFromStorage());
      }
      setBackendWarning(null);
    } catch (_e) {
      setBackendWarning("No se pudo conectar con el servidor. Se usa la copia local.");
      setConfig(loadFromStorage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("[IA CONFIG] useEffect ejecutado");
    loadFromBackend();
  }, [loadFromBackend]);

  function saveConfig() {
    setError(null);
    setSuccess(false);
    setBackendWarning(null);
    setSaving(true);

    console.log("[IA CONFIG] Saving:", { promptBase: config.base, modulesKeys: Object.keys(config.modules) });
    const payload = { basePrompt: config.base, modulos: config.modules };

    fetch(API_IA, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          console.log("[IA CONFIG] Loaded after save (server response):", json.data?.basePrompt != null ? "present" : "missing", json.data?.modulos ? Object.keys(json.data.modulos) : []);
          setSuccess(true);
          saveToStorage(config);
          setTimeout(() => setSuccess(false), 3000);
        } else {
          saveToStorage(config);
          setBackendWarning(
            json?.error ?? "El servidor no guardó los cambios. Se guardó en este dispositivo."
          );
        }
      })
      .catch(() => {
        saveToStorage(config);
        setBackendWarning(
          "No se pudo conectar con el servidor. La configuración se guardó solo en este dispositivo."
        );
      })
      .finally(() => {
        setSaving(false);
      });
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
    setBackendWarning(null);
  }

  console.log("[IA CONFIG] estado final", { basePrompt: config.base, modulos: config.modules });

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

        {backendWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {backendWarning}
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
                      value={config.modules[moduleId] ?? ""}
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
