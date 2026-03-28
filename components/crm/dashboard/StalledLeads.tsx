"use client";

import Link from "next/link";
import type { StalledLead } from "@/lib/crm/metrics";

type Props = {
  leads: StalledLead[];
};

export function StalledLeads({ leads }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Leads estancados</h2>
      <p className="mt-1 text-sm text-slate-500">
        Según umbral por etapa: Nuevo &gt;5 días, Contactado &gt;7, Propuesta &gt;10 (máx. 10)
      </p>
      <ul className="mt-4 space-y-2">
        {leads.length === 0 ? (
          <li className="text-sm text-slate-500 py-2">Ningún lead estancado.</li>
        ) : (
          leads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/leads/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm hover:bg-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">{l.nombre ?? "—"}</div>
                  <div className="text-xs text-slate-500">
                    {l.leads87StageLabel ? (
                      <>
                        <span className="font-medium text-slate-600">{l.leads87StageLabel}</span>
                        {l.leads87Progress != null ? (
                          <span className="text-slate-400"> · {l.leads87Progress}%</span>
                        ) : null}
                        <span className="block truncate text-slate-400">CRM: {l.pipeline ?? "—"}</span>
                      </>
                    ) : (
                      (l.pipeline ?? "Sin etapa")
                    )}
                  </div>
                </div>
                <div className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {l.daysInStage} días
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
