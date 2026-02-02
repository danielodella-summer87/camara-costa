"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { usePermissions } from "@/lib/rbac/usePermissions";

type Ticket = {
  id: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  created_by: string;
  admin_assignee: string | null;
  title: string;
  description: string;
  type: "bug" | "improvement" | "suggestion";
  priority: "low" | "medium" | "high" | "critical";
  status: "new" | "triage" | "in_progress" | "resolved" | "closed";
  closed_at: string | null;
};

export default function MesaDeAyudaPage() {
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [showClosed, setShowClosed] = useState(false);

  async function fetchTickets() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (priority) qs.set("priority", priority);
      if (type) qs.set("type", type);
      if (showClosed) qs.set("include_closed", "1");
      else qs.delete("include_closed");

      const res = await fetch(`/api/admin/helpdesk/tickets?${qs.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error cargando tickets");

      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();
  }, [status, priority, type, showClosed]);

  const badge = useMemo(() => {
    return {
      new: "bg-slate-100 text-slate-700",
      triage: "bg-amber-100 text-amber-800",
      in_progress: "bg-blue-100 text-blue-800",
      resolved: "bg-emerald-100 text-emerald-800",
      closed: "bg-slate-200 text-slate-700",
      low: "bg-slate-100 text-slate-700",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-amber-100 text-amber-800",
      critical: "bg-red-100 text-red-800",
      bug: "bg-red-50 text-red-700",
      improvement: "bg-indigo-50 text-indigo-700",
      suggestion: "bg-emerald-50 text-emerald-700",
    } as Record<string, string>;
  }, []);

  return (
    <PageContainer>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mesa de ayuda</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tickets de sugerencias, errores y mejoras (con capturas).
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <select className="rounded-xl border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Estado (todos)</option>
              <option value="new">Nuevo</option>
              <option value="triage">En revisión</option>
              <option value="in_progress">En progreso</option>
              <option value="resolved">Resuelto</option>
              <option value="closed">Cerrado</option>
            </select>

            <select className="rounded-xl border px-3 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Prioridad (todas)</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>

            <select className="rounded-xl border px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Tipo (todos)</option>
              <option value="bug">Error</option>
              <option value="improvement">Mejora</option>
              <option value="suggestion">Sugerencia</option>
            </select>

            <label className="ml-2 inline-flex items-center gap-2 text-sm text-slate-700 select-none">
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(e) => setShowClosed(e.target.checked)}
              />
              Ver cerrados
            </label>
          </div>

          {hasPermission("helpdesk.write") && (
            <Link
              href="/admin/mesa-de-ayuda/create"
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              + Nuevo ticket
            </Link>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white">
          <div className="grid grid-cols-[1fr_140px] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            <div>Título</div>
            <div>Estado</div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">No hay tickets.</div>
          ) : (
            <div className="divide-y">
              {rows.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/mesa-de-ayuda/${t.id}`}
                  className="grid grid-cols-[1fr_140px] items-center px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{t.title}</div>
                    <div className="truncate text-xs text-slate-500">{t.description}</div>
                  </div>

                  <div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge[t.status]}`}>
                      {t.status === "new"
                        ? "Nuevo"
                        : t.status === "triage"
                        ? "En revisión"
                        : t.status === "in_progress"
                        ? "En progreso"
                        : t.status === "resolved"
                        ? "Resuelto"
                        : "Cerrado"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
