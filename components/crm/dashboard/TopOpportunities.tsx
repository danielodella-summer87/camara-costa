"use client";

import Link from "next/link";
import { formatLeadUnifiedNextAction, type LeadForMetrics } from "@/lib/crm/metrics";

type Lead = Pick<
  LeadForMetrics,
  | "id"
  | "nombre"
  | "pipeline"
  | "rating"
  | "next_activity_type"
  | "next_activity_at"
  | "pending_agenda_accion"
  | "leads87Flow"
>;

type Props = {
  leads: Lead[];
};

function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-amber-500" aria-label={`${r} de 5`}>
      {"★".repeat(r)}{"☆".repeat(5 - r)}
    </span>
  );
}

export function TopOpportunities({ leads }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Top oportunidades</h2>
      <p className="mt-1 text-sm text-slate-500">
        Por avance LEADS87, rating y actividad (máx. 5; sin proceso completo al 100%)
      </p>
      <ul className="mt-4 space-y-2">
        {leads.length === 0 ? (
          <li className="text-sm text-slate-500 py-2">Sin oportunidades activas.</li>
        ) : (
          leads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/leads/${l.id}`}
                className="block rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm hover:bg-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="font-medium text-slate-900 truncate">{l.nombre ?? "—"}</div>
                <div className="mt-0.5 text-xs text-slate-600">
                  {l.leads87Flow?.stageLabel ? (
                    <>
                      <span className="font-medium text-slate-700">{l.leads87Flow.stageLabel}</span>
                      {l.leads87Flow.progress != null ? (
                        <span className="text-slate-500"> · {l.leads87Flow.progress}%</span>
                      ) : null}
                      <span className="block truncate text-slate-500">CRM: {l.pipeline ?? "—"}</span>
                    </>
                  ) : (
                    (l.pipeline ?? "Sin etapa")
                  )}
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs">
                    <Stars rating={Number(l.rating ?? 0)} />
                  </span>
                  <span className="text-xs text-slate-500 truncate max-w-[140px]">
                    Próxima: {formatLeadUnifiedNextAction(l as LeadForMetrics)}
                  </span>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
