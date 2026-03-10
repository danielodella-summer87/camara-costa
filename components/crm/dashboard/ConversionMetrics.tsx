"use client";

import type { ConversionPair } from "@/lib/crm/metrics";

type Props = {
  pairs: ConversionPair[];
};

export function ConversionMetrics({ pairs }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Conversión entre etapas</h2>
      <p className="mt-1 text-sm text-slate-500">
        Porcentaje que avanza a la siguiente etapa (snapshot actual)
      </p>
      <div className="mt-4 space-y-3">
        {pairs.length === 0 ? (
          <p className="text-sm text-slate-500">Sin datos suficientes.</p>
        ) : (
          pairs.map((pair, i) => (
            <div key={`${pair.from}-${pair.to}-${i}`} className="flex items-center justify-between gap-4">
              <div className="text-sm text-slate-700">
                <span className="font-medium">{pair.from}</span>
                <span className="mx-1.5 text-slate-400">→</span>
                <span className="font-medium">{pair.to}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
                {pair.percent != null ? `${pair.percent}%` : "—"}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
