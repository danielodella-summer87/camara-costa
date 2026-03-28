"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

type Accion = {
  id: string;
  socio_id: string | null;
  lead_id: string | null;
  tipo: string;
  nota: string | null;
  lugar?: string | null;
  hora?: string | null; // "HH:MM"
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
  /** Solo leads: tras la primera acción comercial histórica, refrescar sesión Meet en el padre. */
  onFirstCommercialActionSaved?: () => void;
  /** ID de sesión Meet activa → enlace directo al asistente (`/admin/leads/[id]/meet-sessions/[sessionId]`). */
  meetAssistantSessionId?: string | null;
  /** Sin sesión activa: flujo existente de la ficha (prompt Meet + redirect al asistente). */
  onStartMeetAssistant?: () => void | Promise<void>;
};

export default function Acciones({
  socioId,
  leadId,
  onFirstCommercialActionSaved,
  meetAssistantSessionId = null,
  onStartMeetAssistant,
}: AccionesProps) {
  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [lugar, setLugar] = useState("");
  const [hora, setHora] = useState("00:00");
  const [fechaLimite, setFechaLimite] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  /** Contrae el bloque tras la primera acción (solo lead). */
  const [commercialBlockCollapsed, setCommercialBlockCollapsed] = useState(false);
  /** Muestra CTA hacia asistente de cierre de reunión tras la primera acción. */
  const [showMeetAssistantCue, setShowMeetAssistantCue] = useState(false);
  /** Feedback breve al guardar cuando ya había acciones. */
  const [ephemeralSuccess, setEphemeralSuccess] = useState(false);
  const meetAssistantElRef = useRef<HTMLDivElement | null>(null);

  // Determinar el endpoint según el tipo de entidad
  const entityId = socioId || leadId;
  const entityType = socioId ? "socios" : "leads";
  const apiBasePath = `/api/admin/${entityType}/${entityId}/acciones`;
  const isLeadEntity = Boolean(leadId && !socioId);

  if (!entityId) {
    return (
      <div className="mt-6 rounded-2xl border bg-white p-6">
        <div className="text-sm text-red-600">Error: Se requiere socioId o leadId</div>
      </div>
    );
  }

  async function refreshAcciones(includeDone: boolean = false) {
    setError(null);
    setLoading(true);

    try {
      const url = new URL(apiBasePath, window.location.origin);
      if (includeDone) {
        url.searchParams.set("includeDone", "1");
      }

      const res = await fetch(url.toString(), {
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
    refreshAcciones(showDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityType, showDone]);

  useEffect(() => {
    if (!showMeetAssistantCue || !commercialBlockCollapsed) return;
    const id = window.setTimeout(() => {
      const el = meetAssistantElRef.current ?? document.getElementById("lead-meet-closure-assistant");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = el?.querySelector<HTMLElement>("a[href], button:not([disabled])");
      focusable?.focus({ preventScroll: true });
    }, 150);
    return () => window.clearTimeout(id);
  }, [showMeetAssistantCue, commercialBlockCollapsed]);

  // Filtrar y ordenar por fecha_limite asc (más urgente arriba) y luego created_at desc como fallback
  const accionesOrdenadas = useMemo(() => {
    const base = [...(acciones ?? [])];

    const filtradas = showDone ? base : base.filter((a) => !isDone(a.realizada_at));

    return filtradas.sort((a, b) => {
      const fechaA = a.fecha_limite ? new Date(a.fecha_limite).getTime() : Infinity;
      const fechaB = b.fecha_limite ? new Date(b.fecha_limite).getTime() : Infinity;
      if (fechaA !== fechaB) return fechaA - fechaB;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [acciones, showDone]);

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

    let totalActionsBefore = -1;
    if (isLeadEntity) {
      try {
        const countUrl = new URL(apiBasePath, window.location.origin);
        countUrl.searchParams.set("includeDone", "1");
        const countRes = await fetch(countUrl.toString(), {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const countJson = (await countRes.json()) as AccionesApiResponse;
        totalActionsBefore = Array.isArray(countJson?.data) ? countJson.data.length : 0;
      } catch {
        totalActionsBefore = -1;
      }
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
            nota: nota.trim() || "",
            fecha_limite: fechaLimite.trim(),
            lugar: lugar.trim() || null,
            hora: (hora || "00:00").trim(),
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error ?? "Error creando acción");
        }

        // Reset del form después de crear
        setNota("");
        setLugar("");
        setHora("00:00");
        await refreshAcciones(showDone);

        const isFirstLeadAction = isLeadEntity && totalActionsBefore === 0;
        if (isFirstLeadAction) {
          setCommercialBlockCollapsed(true);
          setShowMeetAssistantCue(true);
          onFirstCommercialActionSaved?.();
        } else if (isLeadEntity && (totalActionsBefore > 0 || totalActionsBefore < 0)) {
          setEphemeralSuccess(true);
          window.setTimeout(() => setEphemeralSuccess(false), 3200);
        }
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

        await refreshAcciones(showDone);
      } catch (e: any) {
        setError(e?.message ?? "Error marcando acción como ejecutada");
      }
    });
  }

  return (
    <div className="mt-6 rounded-2xl border bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Acciones comerciales</h3>
          <p className="text-sm text-slate-600">Acciones planificadas con fecha límite</p>
        </div>
        {commercialBlockCollapsed ? (
          <button
            type="button"
            onClick={() => setCommercialBlockCollapsed(false)}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Expandir
          </button>
        ) : null}
      </div>

      {ephemeralSuccess && !commercialBlockCollapsed ? (
        <div
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
          role="status"
        >
          Acción registrada
        </div>
      ) : null}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!commercialBlockCollapsed ? (
        <>
      {/* Campos compartidos: Fecha límite, Lugar, Hora y Nota */}
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

        <div>
          <label className="block text-xs font-medium text-slate-700">Lugar</label>
          <input
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            disabled={isPending}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60"
            placeholder="Ej: Oficina, Zoom, Restaurante..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Hora</label>
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            disabled={isPending}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60"
          />
        </div>

        <div className="md:col-span-3">
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

      {/* Filtro ver ejecutadas */}
      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={showDone}
          onChange={(e) => setShowDone(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Ver ejecutadas
      </label>

      {/* Lista de acciones */}
      <div className="mt-5 overflow-hidden rounded-2xl border">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[140px_120px_140px_100px_100px_120px] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
              <div>Tipo</div>
              <div>Fecha límite</div>
              <div>Lugar</div>
              <div>Hora</div>
              <div>Estado</div>
              <div className="text-right">Acción</div>
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
                      className="grid grid-cols-[140px_120px_140px_100px_100px_120px] items-center px-4 py-3 text-sm"
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
                      <div className="text-slate-700">{a.lugar?.trim() ? a.lugar : "—"}</div>
                      <div className="text-slate-700">{a.hora?.trim() ? a.hora : "00:00"}</div>
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
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          Bloque contraído. Usá <span className="font-medium">Expandir</span> para cargar más acciones comerciales.
        </p>
      )}

      {showMeetAssistantCue && isLeadEntity && leadId ? (
        <div
          ref={meetAssistantElRef}
          id="lead-meet-closure-assistant"
          tabIndex={-1}
          className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <p className="text-sm font-semibold text-emerald-950">Acción registrada</p>
          <p className="mt-1 text-sm text-emerald-900/95">
            Ahora podés continuar con el asistente para cierre de reunión con el lead.
          </p>
          <div className="mt-3">
            {meetAssistantSessionId ? (
              <Link
                href={`/admin/leads/${leadId}/meet-sessions/${meetAssistantSessionId}`}
                className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Abrir asistente de cierre de reunión
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void onStartMeetAssistant?.()}
                disabled={!onStartMeetAssistant}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Iniciar asistente de cierre de reunión
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-emerald-800/90">
            Se abre la sesión de Meet asistido ya existente en el sistema (misma herramienta que en la ficha del lead).
          </p>
        </div>
      ) : null}
    </div>
  );
}
