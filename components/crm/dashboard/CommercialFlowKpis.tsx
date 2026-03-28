"use client";

import type { CommercialFlowKpiSummary } from "@/lib/crm/dashboardCommercialFlow";

type Props = {
  summary: CommercialFlowKpiSummary;
};

function KpiCard({
  label,
  count,
  hint,
}: {
  label: string;
  count: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{count}</div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function CommercialFlowKpis({ summary }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Flujo comercial LEADS87</h2>
      <p className="mt-1 text-sm text-slate-500">
        Misma fuente de verdad que la ficha y el listado LEADS87 (macro flow). Incluye leads con proceso
        completo al 100% aunque el pipeline CRM siga activo.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Nuevas" count={summary.nueva} hint="Lead / investigación" />
        <KpiCard label="Activas" count={summary.activa} hint="Diagnóstico, estrategia, servicios" />
        <KpiCard label="En propuesta" count={summary.en_propuesta} />
        <KpiCard label="En seguimiento" count={summary.en_seguimiento} hint="Etapa cierre macro" />
        <KpiCard label="Cerradas" count={summary.cerrada} hint="CRM cerrado o flujo 100%" />
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Avance promedio (leads con pipeline activo):{" "}
        <span className="font-semibold text-slate-900">{summary.avgProgressActive}%</span>
        <span className="text-slate-500"> · Total en cartera: {summary.total}</span>
      </p>
    </section>
  );
}
