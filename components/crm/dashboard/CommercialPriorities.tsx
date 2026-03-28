"use client";

import Link from "next/link";
import type { CommercialPriorityItem } from "@/lib/crm/priorityEngine";

type Props = {
  priorities: CommercialPriorityItem[];
};

function priorityBadgeStyle(level: CommercialPriorityItem["priorityLevel"]) {
  switch (level) {
    case "high":
      return "border-red-200 bg-red-50 text-red-800";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "low":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function priorityLabel(level: CommercialPriorityItem["priorityLevel"]) {
  switch (level) {
    case "high":
      return "Urgencia alta";
    case "medium":
      return "Urgencia media";
    case "low":
    default:
      return "Urgencia baja";
  }
}

export function CommercialPriorities({ priorities }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Prioridades comerciales de hoy
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Leads que requieren atención prioritaria por urgencia, estancamiento o riesgo comercial.
      </p>

      {priorities.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
          No hay prioridades comerciales que requieran atención inmediata.
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {priorities.map((item, index) => (
            <li
              key={item.leadId ? String(item.leadId) : `priority-${index}`}
              className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/30 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-slate-400">
                    {index + 1}.
                  </span>
                  <span className="ml-1 font-semibold text-slate-900">
                    {item.leadName}
                  </span>
                </div>
                <span
                  className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${priorityBadgeStyle(
                    item.priorityLevel
                  )}`}
                >
                  {priorityLabel(item.priorityLevel)}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700">
                {item.headline}
              </p>
              {item.reasons.length > 0 && (
                <ul className="list-inside list-disc text-xs text-slate-600">
                  {item.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              {item.nextActionText && (
                <p className="text-xs text-slate-500">
                  Próxima acción: {item.nextActionText}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-2">
                <Link
                  href={`/admin/leads/${item.leadId}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ver lead
                </Link>
                <Link
                  href="/admin/agenda"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ver Agenda
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
