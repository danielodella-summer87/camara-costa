"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AgendaItem = {
  id: string;
  tipo: string;
  fecha_limite: string; // YYYY-MM-DD
  nota: string | null;
  created_at: string;
  lead_id: string | null;
  socio_id: string | null;
  owner_type: "lead" | "socio";
  owner_name: string | null;
};

type AgendaApiResponse = {
  data?: AgendaItem[];
  error?: string | null;
};

export default function AgendaPage() {
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgenda() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/agenda", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });

        const json = (await res.json()) as AgendaApiResponse;

        if (!res.ok) {
          throw new Error(json?.error ?? "Error cargando agenda");
        }

        const items = Array.isArray(json?.data) ? json.data : [];
        setAgendaItems(items);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando agenda");
        setAgendaItems([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAgenda();
  }, []);

  // Agrupar acciones por día
  const groupedByDay = useMemo(() => {
    const groups: Record<string, AgendaItem[]> = {};

    for (const item of agendaItems) {
      const dayKey = item.fecha_limite; // YYYY-MM-DD
      if (!groups[dayKey]) {
        groups[dayKey] = [];
      }
      groups[dayKey].push(item);
    }

    return groups;
  }, [agendaItems]);

  // Ordenar días
  const sortedDays = useMemo(() => {
    return Object.keys(groupedByDay).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
  }, [groupedByDay]);

  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return "Hoy";
      } else if (diffDays === 1) {
        return "Mañana";
      } else if (diffDays === -1) {
        return "Ayer";
      } else if (diffDays < 0) {
        return `${Math.abs(diffDays)} días vencidos`;
      } else {
        return date.toLocaleDateString("es-UY", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
    } catch {
      return dateStr;
    }
  }

  function formatDateShort(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("es-UY", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  function isOverdue(dateStr: string): boolean {
    try {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date < today;
    } catch {
      return false;
    }
  }

  function getTipoColor(tipo: string): string {
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes("llamada")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (tipoLower.includes("whatsapp")) return "bg-green-50 text-green-700 border-green-200";
    if (tipoLower.includes("email")) return "bg-purple-50 text-purple-700 border-purple-200";
    if (tipoLower.includes("reunion")) return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }

  function getOwnerLink(item: AgendaItem): string {
    if (item.owner_type === "lead" && item.lead_id) {
      return `/admin/leads/${item.lead_id}`;
    }
    if (item.owner_type === "socio" && item.socio_id) {
      return `/admin/socios/${item.socio_id}`;
    }
    return "#";
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
        <p className="mt-1 text-sm text-slate-600">
          Acciones pendientes de leads y socios (últimos 7 días + próximos 14 días)
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
          Cargando agenda...
        </div>
      ) : sortedDays.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
          No hay acciones pendientes en el rango visible (últimos 7 días + próximos 14 días).
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDays.map((dayKey) => {
            const items = groupedByDay[dayKey];
            const overdue = isOverdue(dayKey);

            return (
              <div key={dayKey} className="rounded-2xl border bg-white overflow-hidden">
                {/* Encabezado sticky del día */}
                <div
                  className={`sticky top-0 z-10 px-6 py-4 border-b ${
                    overdue
                      ? "bg-red-50 border-red-200"
                      : dayKey === new Date().toISOString().split("T")[0]
                      ? "bg-blue-50 border-blue-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2
                        className={`text-lg font-semibold ${
                          overdue ? "text-red-900" : "text-slate-900"
                        }`}
                      >
                        {formatDate(dayKey)}
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {formatDateShort(dayKey)} • {items.length} {items.length === 1 ? "acción" : "acciones"}
                      </p>
                    </div>
                    {overdue && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 border border-red-200">
                        Vencida
                      </span>
                    )}
                  </div>
                </div>

                {/* Lista de acciones del día */}
                <div className="divide-y">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={getOwnerLink(item)}
                      className="block px-6 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${getTipoColor(
                                item.tipo
                              )}`}
                            >
                              {item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {item.owner_type === "lead" ? "Lead" : "Socio"}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {item.owner_name || `Sin nombre (${item.owner_type})`}
                          </p>
                          {item.nota && (
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{item.nota}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-500">
                            Creada: {new Date(item.created_at).toLocaleDateString("es-UY")}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
