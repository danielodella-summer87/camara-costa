"use client";

import type { PipelineCount } from "@/lib/crm/metrics";

type Props = {
  pipelineCounts: PipelineCount[];
  totalActive: number;
};

const MAX_BAR = 24;

export function PipelineSummary({ pipelineCounts, totalActive }: Props) {
  const maxCount = Math.max(1, ...pipelineCounts.map((p) => p.count));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Pipeline total</h2>
      <p className="mt-1 text-sm text-slate-500">
        Distribución por <span className="font-medium text-slate-600">columna CRM</span> (referencia). El
        avance real LEADS87 está en las tarjetas de flujo arriba.
        <br />
        Total leads activos (CRM): <span className="font-semibold text-slate-700">{totalActive}</span>
      </p>
      <div className="mt-4 space-y-3">
        {pipelineCounts.length === 0 ? (
          <p className="text-sm text-slate-500">Sin datos de pipeline.</p>
        ) : (
          pipelineCounts.map(({ pipeline, count }) => {
            const width = maxCount > 0 ? Math.round((count / maxCount) * MAX_BAR) : 0;
            return (
              <div key={pipeline} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-sm font-medium text-slate-700 truncate" title={pipeline}>
                  {pipeline || "Sin etapa"}
                </div>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div className="h-6 flex-1 max-w-[240px] rounded-md bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-md bg-slate-400"
                      style={{ width: `${Math.max(2, width)}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-900">
                    {count}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
