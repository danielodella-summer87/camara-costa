"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSocioAccion, deleteSocioAccion } from "./acciones.actions";

type Accion = {
  id: string;
  socio_id: string;
  tipo: string;
  nota: string | null;
  realizada_at: string; // ISO
};

function cls(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function fmt(dtIso: string) {
  try {
    return new Date(dtIso).toLocaleString("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dtIso;
  }
}

const TIPOS = ["Llamada", "WhatsApp", "Email", "Reunión", "Visita", "Otro"] as const;

export default function SocioAcciones({
  socioId,
  initialAcciones,
}: {
  socioId: string;
  initialAcciones: Accion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("Llamada");
  const [nota, setNota] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const acciones = useMemo(() => initialAcciones ?? [], [initialAcciones]);

  function toast(msg: string) {
    setSaved(msg);
    window.setTimeout(() => setSaved(null), 1600);
  }

  function onQuick(tipoQuick: (typeof TIPOS)[number]) {
    setErr(null);
    startTransition(async () => {
      try {
        await createSocioAccion({ socio_id: socioId, tipo: tipoQuick, nota: "" });
        router.refresh();
        toast(`✅ Acción registrada: ${tipoQuick}`);
      } catch (e: any) {
        setErr(e?.message ?? "Error registrando acción");
      }
    });
  }

  function onSubmit() {
    setErr(null);
    startTransition(async () => {
      try {
        await createSocioAccion({ socio_id: socioId, tipo, nota: nota.trim() || "" });
        setOpen(false);
        setNota("");
        setTipo("Llamada");
        router.refresh();
        toast("✅ Acción registrada");
      } catch (e: any) {
        setErr(e?.message ?? "Error registrando acción");
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm("¿Eliminar esta acción?")) return;
    setErr(null);
    startTransition(async () => {
      try {
        await deleteSocioAccion(id);
        router.refresh();
        toast("🗑️ Acción eliminada");
      } catch (e: any) {
        setErr(e?.message ?? "Error eliminando acción");
      }
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">Acciones comerciales</div>
          <div className="text-xs text-slate-500">Historial + registro rápido (impacta semáforo)</div>
        </div>

        <button
          onClick={() => setOpen(true)}
          className={cls(
            "h-10 px-4 rounded-lg text-sm font-medium text-white transition",
            "bg-slate-900 hover:bg-slate-800"
          )}
        >
          + Registrar acción
        </button>
      </div>

      {/* Quick buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {TIPOS.slice(0, 4).map((t) => (
          <button
            key={t}
            disabled={isPending}
            onClick={() => onQuick(t)}
            className={cls(
              "h-9 px-3 rounded-lg text-sm font-medium border transition",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            )}
          >
            + {t}
          </button>
        ))}
      </div>

      {/* Errors / toasts */}
      {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      {saved && <div className="mt-3 text-sm text-emerald-700">{saved}</div>}

      {/* Timeline */}
      <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          <div className="col-span-3">Fecha</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-6">Nota</div>
          <div className="col-span-1 text-right"> </div>
        </div>

        {acciones.length === 0 ? (
          <div className="px-3 py-6 text-sm text-slate-600">
            No hay acciones registradas todavía.
          </div>
        ) : (
          <div className="divide-y">
            {acciones.map((a) => (
              <div key={a.id} className="grid grid-cols-12 px-3 py-3 text-sm">
                <div className="col-span-3 text-slate-700">{fmt(a.realizada_at)}</div>
                <div className="col-span-2 font-medium text-slate-900">{a.tipo}</div>
                <div className="col-span-6 text-slate-700">
                  {a.nota?.trim() ? a.nota : <span className="text-slate-400">—</span>}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    disabled={isPending}
                    onClick={() => onDelete(a.id)}
                    className="text-xs text-slate-500 hover:text-red-600"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-600">Registrar acción</div>
                <div className="text-xs text-slate-500">Queda en historial y recalcula semáforo</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-900">
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as any)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Nota (opcional)</label>
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className="mt-1 min-h-[90px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="Ej: Hablé con Juan, pide propuesta. Próximo paso: enviar mail hoy."
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="h-10 px-4 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                disabled={isPending}
                onClick={onSubmit}
                className={cls(
                  "h-10 px-4 rounded-lg text-sm font-medium text-white transition",
                  "bg-slate-900 hover:bg-slate-800",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>

            {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
          </div>
        </div>
      )}
    </div>
  );
}