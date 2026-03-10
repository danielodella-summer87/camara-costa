"use client";

import Link from "next/link";
import type { CommercialAlert } from "@/lib/crm/metrics";

type Props = {
  alerts: CommercialAlert[];
};

/**
 * Resumen de estado de actividad (indicadores only).
 * No duplica la Agenda: deriva al usuario a /admin/agenda para la ejecución diaria.
 */
export function ActivityStateSummary({ alerts }: Props) {
  const overdueCount = alerts.filter((a) => a.type === "overdue_action").length;
  const noNextCount = alerts.filter((a) => a.type === "no_next_action").length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Estado de actividad</h2>
      <p className="mt-1 text-sm text-slate-500">
        Resumen de indicadores. La ejecución diaria está en Agenda.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="text-sm">
          <span className="font-medium text-slate-700">Acciones vencidas:</span>{" "}
          <span className={overdueCount > 0 ? "font-semibold text-red-600" : "text-slate-600"}>
            {overdueCount}
          </span>
        </div>
        <div className="text-sm">
          <span className="font-medium text-slate-700">Leads sin próxima acción:</span>{" "}
          <span className={noNextCount > 0 ? "font-semibold text-amber-600" : "text-slate-600"}>
            {noNextCount}
          </span>
        </div>
        <div className="ml-auto">
          <Link
            href="/admin/agenda"
            className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver Agenda
          </Link>
        </div>
      </div>
    </section>
  );
}
