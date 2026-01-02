"use client";

import { useMemo, useState, useTransition } from "react";
import { createSocioAccion, deleteSocioAccion } from "../actions";

type Tipo =
  | "email"
  | "reunion"
  | "whatsapp"
  | "visita"
  | "llamada"
  | "otro";

export type SocioAccion = {
  id: string;
  tipo: Tipo;
  nota: string;
  realizada_at: string;
};

const tipoLabel: Record<Tipo, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  email: "Email",
  reunion: "Reunión",
  visita: "Visita",
  otro: "Otro",
};

export default function SocioAcciones({
  socioId,
  acciones,
}: {
  socioId: string;
  acciones: SocioAccion[];
}) {
  const [tipo, setTipo] = useState<Tipo>("llamada");
  const [nota, setNota] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(() => acciones ?? [], [acciones]);

  function onAdd() {
    setError(null);
    startTransition(async () => {
      try {
        await createSocioAccion({ socio_id: socioId, tipo, nota });
        setNota("");
      } catch (e: any) {
        setError(e?.message ?? "Error");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      await deleteSocioAccion({ socio_id: socioId, id });
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-600">Acciones comerciales</div>
          <div className="text-xs text-slate-500">Timeline por socio</div>
        </div>

        <button
          onClick={onAdd}
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Registrar"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Tipo)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="llamada">Llamada</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="reunion">Reunión</option>
            <option value="visita">Visita</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-600">Nota</label>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: Llamé, pidió propuesta y seguimiento el viernes."
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {error && <div className="mt-3 text-sm text-red-600">⚠️ {error}</div>}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="text-xs font-medium text-slate-600">
          Historial ({ordered.length})
        </div>

        {ordered.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">Sin acciones aún.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {ordered.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">
                    {tipoLabel[a.tipo]} ·{" "}
                    {new Date(a.realizada_at).toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-slate-900 break-words">
                    {a.nota}
                  </div>
                </div>

                <button
                  onClick={() => onDelete(a.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Borrar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}