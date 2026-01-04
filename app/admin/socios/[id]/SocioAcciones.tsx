"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createSocioAccion, deleteSocioAccion } from "./acciones.actions";

type Accion = {
  id: string;
  socio_id: string;
  tipo: string;
  nota: string | null;
  realizada_at: string;
  creada_por?: string | null;
};

type AccionesApiResponse = {
  data?: Accion[];
  error?: string | null;
};

export default function SocioAcciones({ socioId }: { socioId: string }) {
  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  async function refreshAcciones() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/socios/${socioId}/acciones`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as AccionesApiResponse;

      if (!res.ok) {
        throw new Error(json?.error ?? "Error cargando acciones");
      }

      const rows = Array.isArray(json?.data) ? json.data : [];
      setAcciones(rows);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando acciones");
      setAcciones([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAcciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socioId]);

  const accionesOrdenadas = useMemo(() => {
    return [...(acciones ?? [])].sort((a, b) =>
      (b.realizada_at ?? "").localeCompare(a.realizada_at ?? "")
    );
  }, [acciones]);

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("es-UY", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function quickAdd(tipo: string) {
    setError(null);

    startTransition(async () => {
      try {
        await createSocioAccion({
          socio_id: socioId,
          tipo,
          nota: nota.trim(),
        });

        setNota("");
        await refreshAcciones();
      } catch (e: any) {
        setError(e?.message ?? "Error creando acción");
      }
    });
  }

  function onDelete(id: string) {
    setError(null);

    startTransition(async () => {
      try {
        await deleteSocioAccion(id, socioId);
        await refreshAcciones();
      } catch (e: any) {
        setError(e?.message ?? "Error eliminando acción");
      }
    });
  }

  return (
    <div className="rounded-2xl border bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Acciones comerciales
          </h3>
          <p className="text-sm text-slate-600">
            Historial + registro rápido (impacta semáforo)
          </p>
        </div>

        <button
          type="button"
          onClick={() => quickAdd("Reunión")}
          disabled={isPending}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          + Registrar acción
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => quickAdd("Llamada")}
          disabled={isPending}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          + Llamada
        </button>

        <button
          type="button"
          onClick={() => quickAdd("WhatsApp")}
          disabled={isPending}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          + WhatsApp
        </button>

        <button
          type="button"
          onClick={() => quickAdd("Email")}
          disabled={isPending}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          + Email
        </button>

        <button
          type="button"
          onClick={() => quickAdd("Reunión")}
          disabled={isPending}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          + Reunión
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Nota rápida:</span>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Opcional…"
            className="h-9 w-[320px] rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-[220px_140px_1fr_44px] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
          <div>Fecha</div>
          <div>Tipo</div>
          <div>Nota</div>
          <div></div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
        ) : accionesOrdenadas.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            No hay acciones registradas todavía.
          </div>
        ) : (
          <div className="divide-y">
            {accionesOrdenadas.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[220px_140px_1fr_44px] items-center px-4 py-3 text-sm"
              >
                <div className="text-slate-700">{formatDate(a.realizada_at)}</div>
                <div className="font-medium text-slate-900">{a.tipo}</div>
                <div className="text-slate-700">{a.nota ?? "—"}</div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    disabled={isPending}
                    className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}