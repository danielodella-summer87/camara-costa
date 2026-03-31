"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgencyLineSnapshot } from "@/lib/agencyServices/catalog";
import { unitLabelEs } from "@/lib/agencyServices/catalog";
import {
  computeLineFromEffortProfileRow,
  marginVsPriceBase,
  sumInternalCost,
  type InternalCostBreakdownLine,
} from "@/lib/agencyServices/internalCost";

export type ProposalRowDraft = {
  mes: number;
  unit_price: string;
  quantity: string;
  observaciones: string;
  alcance_editado: string;
  notes_agency: string;
};

type RowLike = {
  id: string;
  mes: number;
  precio: number | null;
  moneda: string | null;
  codigo?: string | null;
  nombre?: string | null;
  billing_type?: string | null;
  alcance_editado: string | null;
  observaciones: string | null;
  agency_service_id?: string | null;
  agency_snapshot?: AgencyLineSnapshot | null;
};

function formatBillingType(bt: string | null | undefined): string {
  const b = String(bt ?? "").toLowerCase();
  if (b === "monthly") return "Mensual";
  if (b === "one_time") return "Única vez";
  return "—";
}

function EffortAndMarginBlock({
  agencyServiceId,
  clientRevenue,
  moneda,
  formatMoney,
}: {
  agencyServiceId: string;
  clientRevenue: number;
  moneda: string | null;
  formatMoney: (m: string | null | undefined, p: number | null | undefined) => string;
}) {
  const [lines, setLines] = useState<InternalCostBreakdownLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const res = await fetch(
        `/api/admin/agency-service-effort-profiles?agency_service_id=${encodeURIComponent(agencyServiceId)}`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; profiles?: unknown[]; error?: string };
      if (res.status === 403) {
        setForbidden(true);
        setLines([]);
        return;
      }
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "No se pudo cargar el esfuerzo");
        setLines([]);
        return;
      }
      const profiles = Array.isArray(json.profiles) ? json.profiles : [];
      const breakdown = profiles.map((p) => computeLineFromEffortProfileRow(p as Parameters<typeof computeLineFromEffortProfileRow>[0]));
      setLines(breakdown);
    } catch {
      setError("Error de red");
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [agencyServiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const internalTotal = useMemo(() => sumInternalCost(lines), [lines]);
  const { margin_amount, margin_percent } = marginVsPriceBase(clientRevenue, internalTotal);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Horas por rol (referencia)</p>
      {loading && <p className="mt-2 text-xs text-slate-500">Cargando desglose…</p>}
      {forbidden && (
        <p className="mt-2 text-xs text-amber-800">
          No tenés permiso para ver o editar horas por rol desde aquí. Configuración en Admin → Servicios de la agencia.
        </p>
      )}
      {error && !forbidden && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {!loading && !forbidden && !error && lines.length === 0 && (
        <p className="mt-2 text-xs text-slate-600">No hay perfiles de esfuerzo cargados para este servicio.</p>
      )}
      {lines.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-xs text-slate-800">
          {lines.map((l) => (
            <li key={l.agency_role_id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-1 last:border-0">
              <span>
                {l.role_name}: {l.hours} h × {l.hourly_rate.toLocaleString("es-UY")}
              </span>
              <span className="font-medium">{formatMoney(moneda, l.line_cost)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-1 border-t border-slate-200 pt-3 text-xs sm:grid-cols-2">
        <div>
          <span className="text-slate-600">Costo interno estimado</span>
          <p className="font-semibold text-slate-900">{formatMoney(moneda, internalTotal)}</p>
        </div>
        <div>
          <span className="text-slate-600">Margen sobre esta línea</span>
          <p className={`font-semibold ${margin_amount < 0 ? "text-red-700" : "text-slate-900"}`}>
            {formatMoney(moneda, margin_amount)}
            {margin_percent != null && (
              <span className="ml-1 font-normal text-slate-600">({margin_percent.toFixed(1)}%)</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ProposalServiceLineCard({
  row,
  draft,
  onDraftChange,
  techOpen,
  onToggleTech,
  onSave,
  onDelete,
  servicesSaving,
  deleting,
  formatMoney,
}: {
  row: RowLike;
  draft: ProposalRowDraft;
  onDraftChange: (patch: Partial<ProposalRowDraft>) => void;
  techOpen: boolean;
  onToggleTech: () => void;
  onSave: () => void;
  onDelete: () => void;
  servicesSaving: boolean;
  deleting: boolean;
  formatMoney: (m: string | null | undefined, p: number | null | undefined) => string;
}) {
  const hasAgency = Boolean(row.agency_service_id && row.agency_snapshot);
  const up = draft.unit_price === "" ? NaN : Number(draft.unit_price);
  const q = draft.quantity === "" ? NaN : Number(draft.quantity);
  const subtotal =
    hasAgency && Number.isFinite(up) && Number.isFinite(q) && q > 0 ? up * q : null;
  const clientRevenue = subtotal ?? Number(row.precio ?? 0);

  const title = [row.codigo, row.nombre].filter(Boolean).join(" — ") || "—";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <h4 className="text-lg font-semibold leading-snug text-slate-900">{title}</h4>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={servicesSaving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {servicesSaving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Propuesta (cliente)</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {hasAgency ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Precio unitario</label>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={draft.unit_price}
                  onChange={(e) => onDraftChange({ unit_price: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Cantidad</label>
                <input
                  type="number"
                  step={0.01}
                  min={0.01}
                  value={draft.quantity}
                  onChange={(e) => onDraftChange({ quantity: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Subtotal</label>
                <div className="flex min-h-[50px] items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900">
                  {subtotal != null && Number.isFinite(subtotal) ? formatMoney(row.moneda, subtotal) : "—"}
                </div>
              </div>
            </>
          ) : (
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Precio línea</label>
              <input
                type="number"
                step={0.01}
                min={0}
                value={draft.unit_price}
                onChange={(e) => onDraftChange({ unit_price: e.target.value })}
                className="w-full max-w-xs rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Servicio catálogo clásico (sin snapshot de agencia).</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Nota para el cliente</label>
            <textarea
              value={draft.observaciones}
              onChange={(e) => onDraftChange({ observaciones: e.target.value })}
              rows={3}
              placeholder="Comentarios útiles para la presentación o el cliente…"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Alcance (editable)</label>
            <textarea
              value={draft.alcance_editado}
              onChange={(e) => onDraftChange({ alcance_editado: e.target.value })}
              rows={3}
              placeholder="Qué incluye esta línea para el cliente…"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleTech}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {techOpen ? "Ocultar detalle técnico" : "Ver detalle técnico"}
          </button>
        </div>
      </div>

      {techOpen && (
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Detalle técnico y operativo (interno)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Mes de imputación</label>
              <input
                type="number"
                min={1}
                max={24}
                value={draft.mes}
                onChange={(e) => onDraftChange({ mes: Number(e.target.value) || 1 })}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Tipo de facturación</label>
              <div className="flex min-h-[50px] items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                {formatBillingType(row.billing_type)}
              </div>
            </div>
            {hasAgency && row.agency_snapshot && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Unidad</label>
                <div className="flex min-h-[50px] items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                  {unitLabelEs(row.agency_snapshot.unit)}
                </div>
              </div>
            )}
          </div>

          {hasAgency && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Notas internas (equipo)</label>
              <textarea
                value={draft.notes_agency}
                onChange={(e) => onDraftChange({ notes_agency: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
              />
            </div>
          )}

          {hasAgency && row.agency_service_id && (
            <EffortAndMarginBlock
              agencyServiceId={row.agency_service_id}
              clientRevenue={clientRevenue}
              moneda={row.moneda}
              formatMoney={formatMoney}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function draftFromProposalRow(row: RowLike): ProposalRowDraft {
  if (row.agency_snapshot) {
    return {
      mes: row.mes,
      unit_price: String(row.agency_snapshot.unit_price),
      quantity: String(row.agency_snapshot.quantity),
      observaciones: row.observaciones ?? "",
      alcance_editado: row.alcance_editado ?? "",
      notes_agency: row.agency_snapshot.notes ?? "",
    };
  }
  return {
    mes: row.mes,
    unit_price: row.precio != null ? String(row.precio) : "",
    quantity: "1",
    observaciones: row.observaciones ?? "",
    alcance_editado: row.alcance_editado ?? "",
    notes_agency: "",
  };
}
