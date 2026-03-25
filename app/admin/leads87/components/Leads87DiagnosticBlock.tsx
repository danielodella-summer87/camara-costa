"use client";

import type { RefObject } from "react";

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}

type Props = {
  executionRef: RefObject<HTMLDivElement | null>;
  investigationComplete: boolean;
  diagnosticUrl: string | null | undefined;
  generating: boolean;
  /** 0–100 durante la generación Gamma (mismo esquema estimado que presentación / informe). */
  generationProgress?: number;
  generationEtaSeconds?: number | null;
  error: string | null;
  onGenerateDiagnostic: () => void;
  nextStepLabel: string;
  onNextStep: () => void;
  /**
   * Enlace auxiliar (gamma.app o export PDF Gamma) mientras no hay documento oficial archivado.
   * No es URL oficial del CRM.
   */
  auxiliaryGammaOpenUrl?: string | null;
  /** Indicador opcional de versionado (varias versiones guardadas en CRM). */
  versionHistoryHint?: string | null;
};

/**
 * Bloque principal del Paso 2 (LEADS87): diagnóstico comercial vía Gamma.
 * Debe ir siempre arriba del workspace; la investigación queda en referencia colapsada debajo.
 */
export function Leads87DiagnosticBlock({
  executionRef,
  investigationComplete,
  diagnosticUrl,
  generating,
  generationProgress = 0,
  generationEtaSeconds = null,
  error,
  onGenerateDiagnostic,
  nextStepLabel,
  onNextStep,
  auxiliaryGammaOpenUrl = null,
  versionHistoryHint = null,
}: Props) {
  const hasDoc = Boolean(diagnosticUrl?.trim());
  const pct = Math.min(100, Math.max(0, generationProgress));
  const auxGamma = auxiliaryGammaOpenUrl?.trim() || null;
  const pendingGammaUnarchived = Boolean(!hasDoc && auxGamma);

  const statusLabel = !investigationComplete
    ? "No generado"
    : generating
      ? "Generando diagnóstico…"
      : hasDoc
        ? "Diagnóstico completado"
        : pendingGammaUnarchived
          ? "Generado en Gamma — pendiente de archivar en CRM"
          : "No generado";

  return (
    <div
      ref={executionRef}
      id="leads87-diagnostic-execution-anchor"
      className="scroll-mt-28 mb-6 rounded-xl border-2 border-emerald-300 bg-gradient-to-b from-emerald-50/95 to-white px-4 py-5 shadow-sm"
      role="region"
      aria-labelledby="leads87-diagnostic-heading"
    >
      <h2 id="leads87-diagnostic-heading" className="text-lg font-semibold text-slate-900">
        Diagnóstico comercial
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Estado: <span className="font-medium text-slate-800">{statusLabel}</span>
      </p>
      {versionHistoryHint ? <p className="mt-1 text-xs text-slate-500">{versionHistoryHint}</p> : null}

      {!investigationComplete && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900">
          <p className="font-medium">La investigación aún no está lista.</p>
          <p className="mt-1 text-amber-800/90">
            Completá el Paso 1 — Investigación del lead antes de generar el diagnóstico comercial.
          </p>
        </div>
      )}

      {investigationComplete && !hasDoc && !generating && (
        <div className="mt-4 space-y-3">
          {auxGamma ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
              <p>
                Este documento aún no está archivado en el CRM. Abrilo en Gamma y exportá el PDF para persistirlo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={auxGamma}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-950 shadow-sm hover:bg-amber-50"
                >
                  Abrir en Gamma
                </a>
                <button
                  type="button"
                  onClick={onGenerateDiagnostic}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Generar de nuevo
                </button>
              </div>
              <p className="mt-2 text-xs text-amber-900/80">
                El flujo comercial solo avanza con el PDF archivado en el CRM; este enlace es auxiliar.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700">
                La investigación está completa. Podés generar el diagnóstico comercial.
              </p>
              <button
                type="button"
                onClick={onGenerateDiagnostic}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Generar diagnóstico comercial
              </button>
            </>
          )}
        </div>
      )}

      {generating && (
        <div
          className="mt-4 rounded-xl border-2 border-emerald-400 bg-gradient-to-b from-emerald-50/90 to-white px-4 py-4 shadow-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex gap-4">
            <span
              className="mt-1 inline-block h-10 w-10 shrink-0 animate-spin rounded-full border-[3px] border-emerald-200 border-t-emerald-600"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight text-slate-900">
                Generando diagnóstico comercial en Gamma…
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Consultamos el estado cada pocos segundos. Cuando termine, se archivará el PDF en el CRM y se abrirá el
                documento.
              </p>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progreso estimado de generación del diagnóstico"
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-700">{pct}% completado (estimado)</p>
              <p className="mt-1 text-xs text-slate-500">
                {generationEtaSeconds != null
                  ? pct < 15
                    ? `Tiempo aproximado restante: ${formatTime(generationEtaSeconds)}`
                    : `Tiempo estimado restante: ${formatTime(generationEtaSeconds)}`
                  : "Calculando tiempo estimado…"}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {investigationComplete && hasDoc && !generating && (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-sm text-emerald-900">
            <p className="font-semibold">Diagnóstico completado</p>
            <p className="mt-1 text-emerald-800">Puedes avanzar al siguiente paso del proceso.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {diagnosticUrl?.trim() ? (
              <a
                href={diagnosticUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Abrir documento
              </a>
            ) : null}
            <button
              type="button"
              onClick={onNextStep}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              {nextStepLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
