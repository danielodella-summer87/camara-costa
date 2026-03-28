"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COMMERCIAL_STRATEGY_FIELD_KEYS,
  COMMERCIAL_STRATEGY_LABELS,
  emptyCommercialStrategyStored,
  type CommercialStrategyStored,
  type CommercialStrategyUserInputs,
} from "@/lib/crm/commercialStrategyTypes";
import {
  hasCommercialStrategyJsonRecord,
  parseCommercialStrategyStored,
} from "@/lib/crm/commercialStrategyFlow";

type Props = {
  leadId: string;
  commercialStrategyJson: unknown;
  strategyApprovedAt: string | null | undefined;
  investigationComplete: boolean;
  diagnosticComplete: boolean;
  onUpdated: () => void | Promise<void>;
};

const PRIORIDAD = ["captación", "posicionamiento", "retención", "automatización"] as const;
const URGENCIA = ["alta", "media", "baja"] as const;
const PRESUPUESTO = ["bajo", "medio", "alto"] as const;

function hasDraftFields(s: CommercialStrategyStored): boolean {
  return COMMERCIAL_STRATEGY_FIELD_KEYS.some((k) => {
    const v = (s.edited[k] ?? s.generated[k] ?? "").trim();
    return v.length > 0;
  });
}

/** Estados UX del bloque (sin tocar persistencia ni APIs). */
type StrategyBlockVisibleState =
  | "idle"
  | "generating"
  | "generated_pending_confirmation"
  | "confirmed";

export function Leads87StrategyWorkspace({
  leadId,
  commercialStrategyJson,
  strategyApprovedAt,
  investigationComplete,
  diagnosticComplete,
  onUpdated,
}: Props) {
  const approved = Boolean(strategyApprovedAt?.trim());
  const [stored, setStored] = useState<CommercialStrategyStored>(() => {
    return parseCommercialStrategyStored(commercialStrategyJson) ?? emptyCommercialStrategyStored();
  });
  const [busy, setBusy] = useState<"generate" | "save" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoTriedRef = useRef(false);

  useEffect(() => {
    setStored(parseCommercialStrategyStored(commercialStrategyJson) ?? emptyCommercialStrategyStored());
  }, [commercialStrategyJson, strategyApprovedAt, leadId]);

  const setUserInput = useCallback(<K extends keyof CommercialStrategyUserInputs>(key: K, value: string) => {
    setStored((prev) => ({
      ...prev,
      userInputs: { ...prev.userInputs, [key]: value },
    }));
  }, []);

  const setEditedField = useCallback((key: (typeof COMMERCIAL_STRATEGY_FIELD_KEYS)[number], value: string) => {
    setStored((prev) => ({
      ...prev,
      edited: { ...prev.edited, [key]: value },
    }));
  }, []);

  const runGenerate = useCallback(
    async (regenerate: boolean) => {
      setBusy("generate");
      setError(null);
      try {
        const res = await fetch(`/api/admin/leads/${leadId}/commercial-strategy/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regenerate,
            userInputs: stored.userInputs,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo generar");
        if (json.strategy) setStored(json.strategy as CommercialStrategyStored);
        await onUpdated();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al generar");
      } finally {
        setBusy(null);
      }
    },
    [leadId, stored.userInputs, onUpdated]
  );

  const runSave = useCallback(async () => {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/commercial-strategy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: stored }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo guardar");
      if (json.strategy) setStored(json.strategy as CommercialStrategyStored);
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(null);
    }
  }, [leadId, stored, onUpdated]);

  const runConfirm = useCallback(async () => {
    setBusy("confirm");
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/commercial-strategy/confirm`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo confirmar");
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al confirmar");
    } finally {
      setBusy(null);
    }
  }, [leadId, onUpdated]);

  useEffect(() => {
    if (approved) return;
    if (autoTriedRef.current) return;
    if (!investigationComplete || !diagnosticComplete) return;
    const leadLike = { commercial_strategy_json: commercialStrategyJson };
    if (hasCommercialStrategyJsonRecord(leadLike)) return;
    autoTriedRef.current = true;
    void runGenerate(false);
  }, [approved, investigationComplete, diagnosticComplete, commercialStrategyJson, runGenerate]);

  const canGenerate = investigationComplete && diagnosticComplete && !approved;
  const hasStrategyText = useMemo(() => hasDraftFields(stored), [stored]);

  const visibleState = useMemo((): StrategyBlockVisibleState => {
    if (approved) return "confirmed";
    if (busy === "generate") return "generating";
    if (hasStrategyText) return "generated_pending_confirmation";
    return "idle";
  }, [approved, busy, hasStrategyText]);

  const displayValue = useCallback(
    (k: (typeof COMMERCIAL_STRATEGY_FIELD_KEYS)[number]) => {
      return (stored.edited[k] ?? stored.generated[k] ?? "").trim();
    },
    [stored]
  );

  const statusBadge = useMemo(() => {
    switch (visibleState) {
      case "confirmed":
        return (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
            Estrategia confirmada
          </span>
        );
      case "generated_pending_confirmation":
        return (
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-950">
            Estrategia generada
          </span>
        );
      case "generating":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-950">
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700"
              aria-hidden
            />
            Generando…
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {canGenerate ? "Sin generar" : "Bloqueada"}
          </span>
        );
    }
  }, [visibleState, canGenerate]);

  const busyAny = busy !== null;
  /** Mientras la IA genera o se confirma, no editar el borrador (evita estado confuso). */
  const freezeStrategyForm = approved || busy === "generate" || busy === "confirm";

  return (
    <div id="leads87-strategy-block" className="space-y-6 scroll-mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Estrategia comercial</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            La IA propone en base a investigación y diagnóstico; validás, ajustás y confirmás antes de armar servicios.
          </p>
        </div>
        {statusBadge}
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" data-strategy-ux-state={visibleState}>
        {visibleState === "generating" ? (
          <div className="flex flex-wrap items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-950">
            <span
              className="mt-0.5 inline-block h-10 w-10 shrink-0 animate-spin rounded-full border-[3px] border-emerald-200 border-t-emerald-600"
              aria-hidden
            />
            <div>
              <p className="font-semibold text-emerald-950">Generando estrategia…</p>
              <p className="mt-1 text-emerald-900/90">Esto puede tardar unos segundos.</p>
            </div>
          </div>
        ) : null}

        {visibleState === "generated_pending_confirmation" ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
            <p className="font-semibold">Estrategia generada</p>
            <p className="mt-1 text-sky-900/95">
              Revisá el contenido y confirmá la estrategia para continuar al paso de estructura de servicios.
            </p>
            <p className="mt-2 text-xs text-sky-900/85">
              Podés <span className="font-medium">guardar</span> borradores o <span className="font-medium">regenerar</span> si querés
              otro planteo desde la IA.
            </p>
          </div>
        ) : null}

        {visibleState === "confirmed" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold">La dirección estratégica quedó definida</p>
            <p className="mt-1 text-emerald-900/95">Seguí con el siguiente paso del flujo (estructura de servicios y propuesta).</p>
          </div>
        ) : null}

        {visibleState === "idle" && canGenerate ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            <p className="font-medium text-slate-900">Aún no hay estrategia generada</p>
            <p className="mt-1 text-slate-600">
              Presioná <span className="font-semibold text-slate-800">Generar estrategia</span> para obtener la propuesta de la IA.
            </p>
          </div>
        ) : null}

        {visibleState === "idle" && !canGenerate ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Generación no disponible todavía</p>
            <p className="mt-1 text-slate-600">
              Completá primero la investigación (Paso 1) y el diagnóstico comercial (Paso 2) para generar la estrategia.
            </p>
          </div>
        ) : null}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <h4 className="text-sm font-semibold text-slate-800">A. Estrategia sugerida por IA</h4>
        <p className="mt-1 text-xs text-slate-600">Editá el texto directamente; al guardar se conserva tu versión.</p>
        <div className="mt-4 space-y-3">
          {COMMERCIAL_STRATEGY_FIELD_KEYS.map((k) => (
            <div key={k}>
              <label className="block text-xs font-medium text-slate-700">{COMMERCIAL_STRATEGY_LABELS[k]}</label>
              <textarea
                value={displayValue(k)}
                onChange={(e) => setEditedField(k, e.target.value)}
                disabled={freezeStrategyForm}
                rows={k === "justificacion" || k === "estrategia_mediano_plazo" ? 4 : 3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-800">B. Ajustes del usuario</h4>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Prioridad negocio</label>
            <select
              value={stored.userInputs.prioridad_negocio ?? ""}
              onChange={(e) => setUserInput("prioridad_negocio", e.target.value)}
              disabled={freezeStrategyForm}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">—</option>
              {PRIORIDAD.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Urgencia</label>
            <select
              value={stored.userInputs.urgencia ?? ""}
              onChange={(e) => setUserInput("urgencia", e.target.value)}
              disabled={freezeStrategyForm}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">—</option>
              {URGENCIA.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Presupuesto</label>
            <select
              value={stored.userInputs.presupuesto ?? ""}
              onChange={(e) => setUserInput("presupuesto", e.target.value)}
              disabled={freezeStrategyForm}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="">—</option>
              {PRESUPUESTO.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-600">Restricciones</label>
          <textarea
            value={stored.userInputs.restricciones ?? ""}
            onChange={(e) => setUserInput("restricciones", e.target.value)}
            disabled={freezeStrategyForm}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            placeholder="Ej. sin pauta en Meta, solo Uruguay, equipo sin diseñador…"
          />
        </div>
      </section>

      {!approved && visibleState !== "generating" ? (
        <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" aria-label="Acciones de estrategia comercial">
          {visibleState === "idle" ? (
            <button
              type="button"
              disabled={!canGenerate || busyAny}
              onClick={() => void runGenerate(false)}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Generar estrategia
            </button>
          ) : null}

          {visibleState === "generated_pending_confirmation" ? (
            <>
              <button
                type="button"
                disabled={busyAny || !hasStrategyText}
                onClick={() => void runConfirm()}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy === "confirm" ? "Confirmando…" : "Confirmar estrategia"}
              </button>
              <button
                type="button"
                disabled={!canGenerate || busyAny}
                onClick={() => void runGenerate(true)}
                className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "generate" ? "Generando…" : "Regenerar"}
              </button>
              <button
                type="button"
                disabled={busyAny || !hasStrategyText}
                onClick={() => void runSave()}
                className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "save" ? "Guardando…" : "Guardar"}
              </button>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
