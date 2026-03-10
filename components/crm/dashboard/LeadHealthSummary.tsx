"use client";

import type { LeadHealthSummaryResult } from "@/lib/crm/leadHealth";

type Props = {
  summary: LeadHealthSummaryResult;
};

export function LeadHealthSummary({ summary }: Props) {
  const { good, warning, critical } = summary;
  const maxCount = Math.max(1, good, warning, critical);

  const criticalNeedAttention = critical > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Salud del pipeline</h2>
      <p className="mt-1 text-sm text-slate-500">
        Estado general de los leads activos según seguimiento y avance.
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-base" aria-hidden>🟢</span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="w-24 shrink-0 text-sm font-medium text-slate-700">Bien</span>
            <div className="flex-1 max-w-[200px] h-6 rounded-md bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-md bg-emerald-400 transition-[width]"
                style={{ width: `${maxCount > 0 ? (good / maxCount) * 100 : 0}%` }}
                aria-hidden
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-900">{good}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base" aria-hidden>🟡</span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="w-24 shrink-0 text-sm font-medium text-slate-700">Atención</span>
            <div className="flex-1 max-w-[200px] h-6 rounded-md bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-md bg-amber-400 transition-[width]"
                style={{ width: `${maxCount > 0 ? (warning / maxCount) * 100 : 0}%` }}
                aria-hidden
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-900">{warning}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base" aria-hidden>🔴</span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="w-24 shrink-0 text-sm font-medium text-slate-700">Crítico</span>
            <div className="flex-1 max-w-[200px] h-6 rounded-md bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-md bg-red-400 transition-[width]"
                style={{ width: `${maxCount > 0 ? (critical / maxCount) * 100 : 0}%` }}
                aria-hidden
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-900">{critical}</span>
          </div>
        </div>
      </div>

      {criticalNeedAttention && (
        <p className="mt-3 text-sm font-medium text-red-700">
          {critical} lead{critical === 1 ? "" : "s"} requieren atención inmediata.
        </p>
      )}
    </section>
  );
}
