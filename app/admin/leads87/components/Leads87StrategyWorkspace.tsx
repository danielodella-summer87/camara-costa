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
  const displayValue = useCallback(
    (k: (typeof COMMERCIAL_STRATEGY_FIELD_KEYS)[number]) => {
      return (stored.edited[k] ?? stored.generated[k] ?? "").trim();
    },
    [stored]
  );

  const badge = useMemo(() => {
    if (approved) {
      return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">Confirmada</span>;
    }
    return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">Borrador</span>;
  }, [approved]);

  return (
    <div id="leads87-strategy-block" className="space-y-6 scroll-mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Estrategia comercial</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            La IA propone en base a investigación y diagnóstico; validás, ajustás y confirmás antes de armar servicios.
          </p>
        </div>
        {badge}
      </div>

      {!approved && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Debés <span className="font-semibold">confirmar la estrategia</span> antes de avanzar a estructura de servicios.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      {!investigationComplete || !diagnosticComplete ? (
        <p className="text-sm text-slate-600">
          Completá primero la investigación (Paso 1) y el diagnóstico comercial (Paso 2) para generar la estrategia.
        </p>
      ) : null}

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
                disabled={approved}
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
              disabled={approved}
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
              disabled={approved}
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
              disabled={approved}
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
            disabled={approved}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            placeholder="Ej. sin pauta en Meta, solo Uruguay, equipo sin diseñador…"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={!canGenerate || busy !== null || approved}
          onClick={() => void runGenerate(false)}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === "generate" ? "Generando…" : "Generar estrategia"}
        </button>
        <button
          type="button"
          disabled={!canGenerate || busy !== null || approved}
          onClick={() => void runGenerate(true)}
          className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          Regenerar
        </button>
        <button
          type="button"
          disabled={busy !== null || approved || !hasDraftFields(stored)}
          onClick={() => void runSave()}
          className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "save" ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          disabled={busy !== null || approved || !hasDraftFields(stored)}
          onClick={() => void runConfirm()}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy === "confirm" ? "Confirmando…" : "Confirmar estrategia"}
        </button>
      </section>
    </div>
  );
}
