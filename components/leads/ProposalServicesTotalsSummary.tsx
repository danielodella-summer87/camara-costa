"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgencyLineSnapshot } from "@/lib/agencyServices/catalog";
import {
  computeLineFromEffortProfileRow,
  marginVsPriceBase,
  sumInternalCost,
  type InternalCostBreakdownLine,
} from "@/lib/agencyServices/internalCost";
import type { ProposalRowDraft } from "@/components/leads/ProposalServiceLineCard";

type RowMinimal = {
  id: string;
  precio: number | null;
  moneda: string | null;
  agency_service_id?: string | null;
  agency_snapshot?: AgencyLineSnapshot | null;
};

function lineRevenue(row: RowMinimal, draft: ProposalRowDraft): number {
  if (row.agency_snapshot) {
    const up = Number(draft.unit_price);
    const q = Number(draft.quantity);
    if (Number.isFinite(up) && Number.isFinite(q) && q > 0) return up * q;
  }
  const p = Number(draft.unit_price);
  if (Number.isFinite(p) && p >= 0) return p;
  return Number(row.precio ?? 0) || 0;
}

/**
 * Resumen agregado (misma lógica que el detalle por línea): ingreso por borrador, costo interno desde perfiles de esfuerzo.
 */
export function ProposalServicesTotalsSummary({
  rows,
  drafts,
  formatMoney,
}: {
  rows: RowMinimal[];
  drafts: Record<string, ProposalRowDraft>;
  formatMoney: (m: string | null | undefined, p: number | null | undefined) => string;
}) {
  const [breakdownByServiceId, setBreakdownByServiceId] = useState<Map<string, InternalCostBreakdownLine[]>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const uniqueAgencyIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const id = r.agency_service_id?.trim();
      if (id) s.add(id);
    }
    return [...s];
  }, [rows]);

  const loadBreakdowns = useCallback(async () => {
    if (uniqueAgencyIds.length === 0) {
      setBreakdownByServiceId(new Map());
      return;
    }
    setLoading(true);
    setForbidden(false);
    try {
      const results = await Promise.all(
        uniqueAgencyIds.map(async (sid) => {
          const res = await fetch(
            `/api/admin/agency-service-effort-profiles?agency_service_id=${encodeURIComponent(sid)}`,
            { cache: "no-store" }
          );
          const json = (await res.json().catch(() => ({}))) as { ok?: boolean; profiles?: unknown[] };
          if (res.status === 403) return { sid, forbidden: true as const, lines: [] as InternalCostBreakdownLine[] };
          if (!res.ok || !json?.ok) return { sid, forbidden: false as const, lines: [] as InternalCostBreakdownLine[] };
          const profiles = Array.isArray(json.profiles) ? json.profiles : [];
          const lines = profiles.map((p) =>
            computeLineFromEffortProfileRow(p as Parameters<typeof computeLineFromEffortProfileRow>[0])
          );
          return { sid, forbidden: false as const, lines };
        })
      );
      const any403 = results.some((r) => r.forbidden);
      if (any403) setForbidden(true);
      const m = new Map<string, InternalCostBreakdownLine[]>();
      for (const r of results) {
        if (!r.forbidden) m.set(r.sid, r.lines);
      }
      setBreakdownByServiceId(m);
    } catch {
      setBreakdownByServiceId(new Map());
    } finally {
      setLoading(false);
    }
  }, [uniqueAgencyIds]);

  useEffect(() => {
    void loadBreakdowns();
  }, [loadBreakdowns]);

  const { totalRevenue, totalInternal, marginTotal, moneda } = useMemo(() => {
    let rev = 0;
    let internal = 0;
    let currency: string | null = rows[0]?.moneda ?? null;

    for (const row of rows) {
      const draft = drafts[row.id];
      if (!draft) continue;
      rev += lineRevenue(row, draft);
      const sid = row.agency_service_id?.trim();
      if (sid) {
        const lines = breakdownByServiceId.get(sid) ?? [];
        internal += sumInternalCost(lines);
      }
      if (row.moneda?.trim()) currency = row.moneda;
    }

    const { margin_amount } = marginVsPriceBase(rev, internal);
    return {
      totalRevenue: rev,
      totalInternal: internal,
      marginTotal: margin_amount,
      moneda: currency,
    };
  }, [rows, drafts, breakdownByServiceId]);

  if (rows.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/90 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Resumen técnico (toda la propuesta)</p>
      {loading && <p className="mt-2 text-xs text-slate-500">Calculando costos internos…</p>}
      {forbidden && (
        <p className="mt-2 text-xs text-amber-800">
          Sin permiso para cargar horas por rol: el costo interno total puede mostrarse incompleto. Configuración en Admin →
          Servicios.
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total propuesta</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(moneda, totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-white bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Costo interno total (estim.)</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(moneda, totalInternal)}</p>
        </div>
        <div className="rounded-lg border border-white bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Margen total (estim.)</p>
          <p
            className={`mt-1 text-lg font-semibold ${marginTotal < 0 ? "text-red-700" : "text-slate-900"}`}
          >
            {formatMoney(moneda, marginTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
