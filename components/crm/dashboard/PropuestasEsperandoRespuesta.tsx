"use client";

import Link from "next/link";

export type PropuestaEnviadaLead = {
  id: string;
  nombre: string | null;
  pipeline: string | null;
  proposal_sent_at: string | null;
  /** Días desde proposal_sent_at hasta hoy. */
  daysSinceSent: number;
};

type Props = {
  leads: PropuestaEnviadaLead[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-UY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function PropuestasEsperandoRespuesta({ leads }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Propuestas esperando respuesta</h2>
      <p className="mt-1 text-sm text-slate-500">
        Propuesta confirmada y enviada al cliente; aún no cerrada (máx. 10).
      </p>
      <ul className="mt-4 space-y-2">
        {leads.length === 0 ? (
          <li className="text-sm text-slate-500 py-2">Ninguna propuesta en espera de respuesta.</li>
        ) : (
          leads.map((l) => (
            <li key={l.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">{l.nombre ?? "—"}</div>
                  <div className="text-xs text-slate-500">
                    Enviada el {formatDate(l.proposal_sent_at)} · {l.daysSinceSent} día{l.daysSinceSent !== 1 ? "s" : ""} desde envío
                  </div>
                </div>
                <Link
                  href={`/admin/leads/${l.id}`}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Registrar respuesta
                </Link>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
