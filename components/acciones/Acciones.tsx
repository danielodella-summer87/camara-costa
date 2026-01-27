"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type Accion = {
  id: string;
  socio_id: string | null;
  lead_id: string | null;
  tipo: string;
  nota: string | null;
  fecha_limite: string | null; // YYYY-MM-DD - fecha límite real
  realizada_at: string | null; // Timestamp ISO cuando se ejecutó (null si pendiente)
  created_at: string;
};

type AccionesApiResponse = {
  data?: Accion[];
  error?: string | null;
};

type AccionesProps = {
  socioId?: string;
  leadId?: string;
};

export default function Acciones({ socioId, leadId }: AccionesProps) {
  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Determinar el endpoint según el tipo de entidad
  const entityId = socioId || leadId;
  const entityType = socioId ? "socios" : "leads";
  const apiBasePath = `/api/admin/${entityType}/${entityId}/acciones`;

  if (!entityId) {
    return (
      <div className="mt-6 rounded-2xl border bg-white p-6">
        <div className="text-sm text-red-600">Error: Se requiere socioId o leadId</div>
      </div>
    );
  }

  async function refreshAcciones() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(apiBasePath, {
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
  }, [entityId, entityType]);

  // Ordenar por fecha_limite asc (más urgente arriba) y luego created_at desc como fallback
  const accionesOrdenadas = useMemo(() => {
    return [...(acciones ?? [])].sort((a, b) => {
      // Primero por fecha_limite (ascendente - más urgente primero)
      const fechaA = a.fecha_limite ? new Date(a.fecha_limite).getTime() : Infinity;
      const fechaB = b.fecha_limite ? new Date(b.fecha_limite).getTime() : Infinity;
      if (fechaA !== fechaB) {
        return fechaA - fechaB;
      }
      // Si tienen la misma fecha_limite, ordenar por created_at desc (más nuevo primero)
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [acciones]);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("es-UY", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  function formatDateTime(iso: string | null) {
    if (!iso) return "—";
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

  function isOverdue(fechaLimite: string | null): boolean {
    if (!fechaLimite) return false;
    try {
      // Comparar solo por día (ignorar hora)
      const fechaLimiteDate = new Date(fechaLimite);
      fechaLimiteDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Vencida si la fecha límite es menor que hoy (pasada)
      return fechaLimiteDate < today;
    } catch {
      return false;
    }
  }

  function isDone(realizadaAt: string | null): boolean {
    // Una acción está ejecutada si realizada_at tiene un timestamp ISO (contiene 'T')
    // Si es null, está pendiente
    if (!realizadaAt) return false;
    // Si contiene 'T', es un timestamp ISO (ejecutada)
    return realizadaAt.includes("T");
  }

  async function quickAdd(tipo: string) {
    setError(null);

    // Validar fecha límite
    if (!fechaLimite || !fechaLimite.trim()) {
      setError("La fecha límite es obligatoria");
      return;
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fechaLimite)) {
      setError("La fecha debe tener formato YYYY-MM-DD");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(apiBasePath, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
          body: JSON.stringify({
            tipo: tipo.trim(),
            nota: nota.trim() || "", // Siempre string, nunca null
            fecha_limite: fechaLimite.trim(), // Usar fecha_limite como deadline real
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error ?? "Error creando acción");
        }

        // Reset solo la nota (mantener fecha límite para siguiente acción)
        setNota("");
        await refreshAcciones();
      } catch (e: any) {
        setError(e?.message ?? "Error creando acción");
      }
    });
  }

  async function onMarkDone(accionId: string) {
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`${apiBasePath}/${accionId}`, {
          method: "PATCH",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error ?? "Error marcando acción como ejecutada");
        }

        await refreshAcciones();
      } catch (e: any) {
        setError(e?.message ?? "Error marcando acción como ejecutada");
      }
    });
  }

  return (
    <div className="mt-6 rounded-2xl border bg-white p-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Acciones comerciales</h3>
        <p className="text-sm text-slate-600">Acciones planificadas con fecha límite</p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Campos compartidos: Fecha límite y Nota */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-slate-600">
            Fecha límite <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
            disabled={isPending}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-600">Nota (opcional)</label>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Descripción de la acción..."
            disabled={isPending}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Botones rápidos de tipo */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => quickAdd("llamada")}
          disabled={isPending || !fechaLimite.trim()}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Llamada
        </button>

        <button
          type="button"
          onClick={() => quickAdd("whatsapp")}
          disabled={isPending || !fechaLimite.trim()}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + WhatsApp
        </button>

        <button
          type="button"
          onClick={() => quickAdd("email")}
          disabled={isPending || !fechaLimite.trim()}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Email
        </button>

        <button
          type="button"
          onClick={() => quickAdd("reunion")}
          disabled={isPending || !fechaLimite.trim()}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Reunión
        </button>
      </div>

      {/* Lista de acciones */}
      <div className="mt-5 overflow-hidden rounded-2xl border">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[140px_120px_100px_1fr_120px_100px] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
              <div>Tipo</div>
              <div>Fecha límite</div>
              <div>Estado</div>
              <div>Nota</div>
              <div>Creada</div>
              <div></div>
            </div>

            {loading ? (
              <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
            ) : accionesOrdenadas.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">No hay acciones planificadas todavía.</div>
            ) : (
              <div className="divide-y">
                {accionesOrdenadas.map((a) => {
                  const done = isDone(a.realizada_at);
                  const overdue = !done && isOverdue(a.fecha_limite);
                  return (
                    <div
                      key={a.id}
                      className="grid grid-cols-[140px_120px_100px_1fr_120px_100px] items-center px-4 py-3 text-sm"
                    >
                      <div className="font-medium text-slate-900 capitalize">{a.tipo}</div>
                      <div className="flex items-center gap-2">
                        <span
                          className={overdue ? "text-red-600 font-semibold" : "text-slate-700"}
                        >
                          {formatDate(a.fecha_limite)}
                        </span>
                        {!done && overdue && (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                            VENCIDA
                          </span>
                        )}
                      </div>
                      <div>
                        {done ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            ✅ Ejecutada
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            Pendiente
                          </span>
                        )}
                      </div>
                      <div className="text-slate-700">{a.nota ?? "—"}</div>
                      <div className="text-xs text-slate-500">{formatDate(a.created_at)}</div>
                      <div className="text-right">
                        {done ? (
                          <span className="text-xs text-slate-400">
                            {formatDateTime(a.realizada_at)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onMarkDone(a.id)}
                            disabled={isPending}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            Ejecutada
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
