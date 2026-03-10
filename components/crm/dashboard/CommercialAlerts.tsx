"use client";

import Link from "next/link";
import type { CommercialAlert } from "@/lib/crm/metrics";
import { AlertTriangle, Clock, FileQuestion, Flame, UserX } from "lucide-react";

type Props = {
  alerts: CommercialAlert[];
};

function severityStyles(severity: CommercialAlert["severity"]) {
  switch (severity) {
    case "high":
      return {
        border: "border-red-200 bg-red-50/80",
        icon: "text-red-600",
        dot: "bg-red-500",
      };
    case "medium":
      return {
        border: "border-amber-200 bg-amber-50/80",
        icon: "text-amber-600",
        dot: "bg-amber-500",
      };
    case "low":
    default:
      return {
        border: "border-slate-200 bg-slate-50/80",
        icon: "text-slate-600",
        dot: "bg-slate-500",
      };
  }
}

function alertIcon(type: CommercialAlert["type"]) {
  switch (type) {
    case "overdue_action":
      return <Clock className="h-4 w-4 shrink-0" aria-hidden />;
    case "proposal_no_response":
      return <FileQuestion className="h-4 w-4 shrink-0" aria-hidden />;
    case "hot_stalled":
      return <Flame className="h-4 w-4 shrink-0" aria-hidden />;
    case "no_next_action":
      return <UserX className="h-4 w-4 shrink-0" aria-hidden />;
    case "early_stage_stalled":
      return <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />;
    default:
      return <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden />;
  }
}

export function CommercialAlerts({ alerts }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Alertas Comerciales Inteligentes</h2>
      <p className="mt-1 text-sm text-slate-500">
        Situaciones que requieren atención comercial prioritaria.
      </p>

      {alerts.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
          No hay alertas prioritarias en este momento.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {alerts.map((alert) => {
            const styles = severityStyles(alert.severity);
            return (
              <li key={`${alert.leadId}-${alert.type}`}>
                <div
                  className={`flex flex-col gap-2 rounded-xl border ${styles.border} px-3 py-2.5`}
                >
                  <div className="flex items-center gap-2">
                    <span className={styles.icon}>{alertIcon(alert.type)}</span>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
                      aria-hidden
                    />
                    <span className="text-sm font-semibold text-slate-900">{alert.title}</span>
                  </div>
                  <div className="pl-6 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{alert.leadName}</div>
                    <div className="text-slate-600">Etapa: {alert.pipeline}</div>
                    <p className="mt-0.5 text-slate-600">{alert.description}</p>
                  </div>
                  <div className="pl-6">
                    <Link
                      href={`/admin/leads/${alert.leadId}`}
                      className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Ver lead
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
