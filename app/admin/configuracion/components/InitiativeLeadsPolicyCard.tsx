"use client";

import { useCallback, useEffect, useState } from "react";

export function InitiativeLeadsPolicyCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [allowMultiple, setAllowMultiple] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/config/initiative-leads", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error cargando configuración");
      setAllowMultiple(Boolean(json?.data?.allow_multiple_leads_per_initiative));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(next: boolean, previous: boolean) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/config/initiative-leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow_multiple_leads_per_initiative: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error guardando");
      setAllowMultiple(Boolean(json?.data?.allow_multiple_leads_per_initiative));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
      setAllowMultiple(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Iniciativas y leads</h2>
      <p className="mt-1 text-xs text-slate-600">
        Control al convertir una iniciativa en lead. El valor se guarda en{" "}
        <code className="rounded bg-slate-100 px-1 text-[11px]">public.config</code> (clave{" "}
        <code className="rounded bg-slate-100 px-1 text-[11px]">allow_multiple_leads_per_initiative</code>
        ).
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Cargando…</p>
      ) : (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300"
            checked={allowMultiple}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.checked;
              const prev = allowMultiple;
              setAllowMultiple(v);
              void save(v, prev);
            }}
          />
          <span>
            <span className="text-sm font-medium text-slate-800">Permitir múltiples leads activos por iniciativa</span>
            <span className="mt-0.5 block text-xs text-slate-600">
              Desactivado (recomendado): si ya existe un lead activo (fuera de los pipelines de cierre centralizados) con la
              misma iniciativa, no se crea otro al convertir.
            </span>
          </span>
        </label>
      )}

      {saving ? <p className="mt-2 text-xs text-slate-500">Guardando…</p> : null}
      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
