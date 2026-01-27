"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

type OwnerType = "lead" | "socio";

type AgendaItem = {
  id: string;
  tipo: string;
  fecha_limite: string; // YYYY-MM-DD
  nota: string | null;
  lugar: string | null;
  created_at: string;
  lead_id: string | null;
  socio_id: string | null;
  owner_type: OwnerType;
  owner_name: string | null;
};

type AgendaApiResponse = {
  data?: AgendaItem[];
  error?: string | null;
};

type QuickFilter = "all" | "overdue" | "today" | "next7";

export default function AgendaPage() {
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // UI filters
  const [q, setQ] = useState<string>("");
  const [owner, setOwner] = useState<"all" | OwnerType>("all");
  const [tipo, setTipo] = useState<string>("all");
  const [quick, setQuick] = useState<QuickFilter>("all");

  // UX: marcar realizada desde agenda
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal crear actividad
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    owner_type: "lead" as OwnerType,
    lead_id: "",
    socio_id: "",
    fecha_limite: "",
    tipo: "llamada",
    nota: "",
    lugar: "",
  });
  const [creating, setCreating] = useState<boolean>(false);

  // Select con búsqueda
  const [ownersData, setOwnersData] = useState<{ leads: Array<{ id: string; nombre: string }>; socios: Array<{ id: string; nombre: string }> }>({
    leads: [],
    socios: [],
  });
  const [ownerSearch, setOwnerSearch] = useState<string>("");
  const [showOwnerDropdown, setShowOwnerDropdown] = useState<boolean>(false);

  // Defaults: últimos 30 días + próximos 14 días
  const defaultPastDays = 30;
  const defaultFutureDays = 14;

  // Construir URL con parámetros según el filtro
  const buildApiUrl = (filter: QuickFilter): string => {
    const baseUrl = "/api/admin/agenda";
    const params = new URLSearchParams();

    if (filter === "overdue") {
      params.set("overdueOnly", "1");
      params.set("pastDays", "365");
      params.set("futureDays", "0");
    } else if (filter === "today") {
      params.set("todayOnly", "1");
    } else if (filter === "next7") {
      params.set("pastDays", "0");
      params.set("futureDays", "7");
    } else {
      // "all" - default
      params.set("pastDays", String(defaultPastDays));
      params.set("futureDays", String(defaultFutureDays));
    }

    return `${baseUrl}?${params.toString()}`;
  };

  async function fetchAgenda() {
    setLoading(true);
    setError(null);

    try {
      const url = buildApiUrl(quick);
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as AgendaApiResponse;

      if (!res.ok) {
        throw new Error(json?.error ?? "Error cargando agenda");
      }

      const items = Array.isArray(json?.data) ? json.data : [];
      setAgendaItems(items);
    } catch (e: unknown) {
      const error = e as { message?: string };
      setError(error?.message ?? "Error cargando agenda");
      setAgendaItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick]);

  // Cargar owners cuando se abre el modal
  useEffect(() => {
    if (showCreateModal) {
      async function loadOwners() {
        try {
          const res = await fetch("/api/admin/agenda/owners", {
            cache: "no-store",
          });
          const json = await res.json();
          if (res.ok && json.data) {
            setOwnersData(json.data);
          }
        } catch (e) {
          console.error("Error cargando owners:", e);
        }
      }
      loadOwners();
    }
  }, [showCreateModal]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!showOwnerDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".owner-dropdown-container")) {
        setShowOwnerDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showOwnerDropdown]);

  const todayKey = useMemo(() => {
    return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  }, []);

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


  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) return "Hoy";
      if (diffDays === 1) return "Mañana";
      if (diffDays === -1) return "Ayer";
      if (diffDays < 0) return `${Math.abs(diffDays)} días vencidos`;

      return date.toLocaleDateString("es-UY", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
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

  function getTipoBadge(tipo: string): string {
    const t = (tipo || "").toLowerCase();
    if (t.includes("llamada")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (t.includes("whatsapp")) return "bg-green-50 text-green-700 border-green-200";
    if (t.includes("email")) return "bg-purple-50 text-purple-700 border-purple-200";
    if (t.includes("reunion") || t.includes("reunión")) return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }

  function getOwnerLink(item: AgendaItem): string {
    if (item.owner_type === "lead" && item.lead_id) return `/admin/leads/${item.lead_id}`;
    if (item.owner_type === "socio" && item.socio_id) return `/admin/socios/${item.socio_id}`;
    return "#";
  }

  function getOwnerLabel(item: AgendaItem): string {
    if (item.owner_type === "lead") return "Lead";
    return "Socio";
  }

  function buildMapsLink(lugar: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar)}`;
  }

  function buildWazeLink(lugar: string): string {
    return `https://waze.com/ul?q=${encodeURIComponent(lugar)}&navigate=yes`;
  }

  const tiposDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const it of agendaItems) {
      if (it.tipo?.trim()) set.add(it.tipo.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [agendaItems]);

  const filteredItems = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return agendaItems.filter((it) => {
      // owner filter
      if (owner !== "all" && it.owner_type !== owner) return false;

      // tipo filter
      if (tipo !== "all" && (it.tipo || "").trim() !== tipo) return false;

      // search (tipo + nota + owner_name)
      if (qq) {
        const hay = [
          it.tipo || "",
          it.nota || "",
          it.owner_name || "",
          getOwnerLabel(it),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }

      return true;
    });
  }, [agendaItems, owner, tipo, q]);

  // Agrupar por día
  const groupedByDay = useMemo(() => {
    const groups: Record<string, AgendaItem[]> = {};
    for (const item of filteredItems) {
      const dayKey = item.fecha_limite; // YYYY-MM-DD
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(item);
    }
    return groups;
  }, [filteredItems]);

  const sortedDays = useMemo(() => {
    return Object.keys(groupedByDay).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
  }, [groupedByDay]);

  async function markAsDone(item: AgendaItem) {
    const accionId = item.id;
    const leadId = item.lead_id;
    const socioId = item.socio_id;

    let endpoint = "";
    if (item.owner_type === "lead" && leadId) {
      endpoint = `/api/admin/leads/${leadId}/acciones/${accionId}`;
    } else if (item.owner_type === "socio" && socioId) {
      endpoint = `/api/admin/socios/${socioId}/acciones/${accionId}`;
    } else {
      alert("No pude determinar el dueño de la acción (lead/socio).");
      return;
    }

    setMarkingId(accionId);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realizada: true }),
      });

      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json?.error ?? "Error marcando como realizada");
      }

      // remover del listado (agenda muestra pendientes)
      setAgendaItems((prev) => prev.filter((x) => x.id !== accionId));
    } catch (e: unknown) {
      const error = e as { message?: string };
      alert(error?.message ?? "Error marcando como realizada");
    } finally {
      setMarkingId(null);
    }
  }

  async function deleteActivity(item: AgendaItem) {
    if (!confirm("¿Seguro que querés borrar esta actividad?")) {
      return;
    }

    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/admin/agenda/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json?.error ?? "Error borrando actividad");
      }

      // remover del listado
      setAgendaItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e: unknown) {
      const error = e as { message?: string };
      alert(error?.message ?? "Error borrando actividad");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreateActivity() {
    if (!createForm.fecha_limite || !createForm.tipo) {
      alert("Faltan campos requeridos: fecha límite y tipo");
      return;
    }

    if (createForm.owner_type === "lead" && !createForm.lead_id?.trim()) {
      alert("Falta lead_id");
      return;
    }

    if (createForm.owner_type === "socio" && !createForm.socio_id?.trim()) {
      alert("Falta socio_id");
      return;
    }

    setCreating(true);
    try {
      const payload: {
        owner_type: OwnerType;
        fecha_limite: string;
        tipo: string;
        nota: string | null;
        lugar: string | null;
        lead_id?: string;
        socio_id?: string;
      } = {
        owner_type: createForm.owner_type,
        fecha_limite: createForm.fecha_limite,
        tipo: createForm.tipo,
        nota: createForm.nota?.trim() || null,
        lugar: createForm.lugar?.trim() || null,
      };

      if (createForm.owner_type === "lead") {
        payload.lead_id = createForm.lead_id.trim();
      } else {
        payload.socio_id = createForm.socio_id.trim();
      }

      const res = await fetch("/api/admin/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json?.error ?? "Error creando actividad");
      }

      // Reset form y cerrar modal
      setCreateForm({
        owner_type: "lead",
        lead_id: "",
        socio_id: "",
        fecha_limite: "",
        tipo: "llamada",
        nota: "",
        lugar: "",
      });
      setOwnerSearch("");
      setShowOwnerDropdown(false);
      setShowCreateModal(false);

      // Refetch agenda
      await fetchAgenda();
    } catch (e: unknown) {
      const error = e as { message?: string };
      alert(error?.message ?? "Error creando actividad");
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
          <p className="mt-1 text-sm text-slate-600">
            Acciones pendientes de leads y socios (últimos 30 días + próximos 14 días)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
        >
          + Agregar actividad
        </button>
      </div>

      {/* Modal crear actividad */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl border bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Nueva actividad</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setOwnerSearch("");
                  setShowOwnerDropdown(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Dueño *</label>
                <select
                  value={createForm.owner_type}
                  onChange={(e) => {
                    setCreateForm({
                      ...createForm,
                      owner_type: e.target.value as OwnerType,
                      lead_id: "",
                      socio_id: "",
                    });
                    setOwnerSearch("");
                    setShowOwnerDropdown(false);
                  }}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="lead">Lead</option>
                  <option value="socio">Socio</option>
                </select>
              </div>

              <div className="relative owner-dropdown-container">
                <label className="text-xs font-semibold text-slate-600">
                  {createForm.owner_type === "lead" ? "Lead" : "Socio"} *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={ownerSearch}
                    onChange={(e) => {
                      setOwnerSearch(e.target.value);
                      setShowOwnerDropdown(true);
                    }}
                    onFocus={() => setShowOwnerDropdown(true)}
                    placeholder={`Buscar ${createForm.owner_type === "lead" ? "lead" : "socio"}...`}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                  {showOwnerDropdown && (
                    <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border bg-white shadow-lg">
                      {(createForm.owner_type === "lead" ? ownersData.leads : ownersData.socios)
                        .filter((o) =>
                          ownerSearch.trim()
                            ? o.nombre.toLowerCase().includes(ownerSearch.toLowerCase())
                            : true
                        )
                        .slice(0, 20)
                        .map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => {
                              setCreateForm({
                                ...createForm,
                                [createForm.owner_type === "lead" ? "lead_id" : "socio_id"]: o.id,
                              });
                              setOwnerSearch(o.nombre);
                              setShowOwnerDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 border-b last:border-b-0"
                          >
                            {o.nombre}
                          </button>
                        ))}
                      {ownerSearch.trim() &&
                        (createForm.owner_type === "lead" ? ownersData.leads : ownersData.socios).filter((o) =>
                          o.nombre.toLowerCase().includes(ownerSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-2 text-sm text-slate-500">No se encontraron resultados</div>
                        )}
                    </div>
                  )}
                </div>
                {(createForm.owner_type === "lead" ? createForm.lead_id : createForm.socio_id) && (
                  <p className="mt-1 text-xs text-slate-500">
                    Seleccionado:{" "}
                    {(createForm.owner_type === "lead" ? ownersData.leads : ownersData.socios).find(
                      (o) => o.id === (createForm.owner_type === "lead" ? createForm.lead_id : createForm.socio_id)
                    )?.nombre || "—"}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Fecha límite *</label>
                  <input
                    type="date"
                    value={createForm.fecha_limite}
                    onChange={(e) => setCreateForm({ ...createForm, fecha_limite: e.target.value })}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">Tipo *</label>
                  <select
                    value={createForm.tipo}
                    onChange={(e) => setCreateForm({ ...createForm, tipo: e.target.value })}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="llamada">Llamada</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="reunion">Reunión</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Nota</label>
                <textarea
                  value={createForm.nota}
                  onChange={(e) => setCreateForm({ ...createForm, nota: e.target.value })}
                  placeholder="Descripción de la actividad..."
                  rows={3}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Lugar</label>
                <input
                  type="text"
                  value={createForm.lugar}
                  onChange={(e) => setCreateForm({ ...createForm, lugar: e.target.value })}
                  placeholder="Dirección o lugar (para abrir en Maps/Waze)"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateActivity}
                disabled={creating}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  creating
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-slate-900 hover:opacity-95"
                }`}
              >
                {creating ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="mb-4 rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600">Buscar</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder='Ej: "email", "whatsapp", "Optica", "seguimiento"...'
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="w-full md:w-52">
              <label className="text-xs font-semibold text-slate-600">Dueño</label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value as "all" | OwnerType)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="all">Todos</option>
                <option value="lead">Leads</option>
                <option value="socio">Socios</option>
              </select>
            </div>

            <div className="w-full md:w-64">
              <label className="text-xs font-semibold text-slate-600">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="all">Todos</option>
                {tiposDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick filter chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "Todas" },
              { id: "overdue", label: "Vencidas" },
              { id: "today", label: "Hoy" },
              { id: "next7", label: "Próx. 7 días" },
            ].map((x) => {
              const active = quick === (x.id as QuickFilter);
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setQuick(x.id as QuickFilter)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {x.label}
                </button>
              );
            })}

            <div className="ml-auto text-xs text-slate-500 self-center">
              Mostrando: <span className="font-semibold text-slate-800">{filteredItems.length}</span>
            </div>
          </div>
        </div>
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
          No hay acciones pendientes para los filtros actuales.
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDays.map((dayKey) => {
            const items = groupedByDay[dayKey] || [];
            const overdue = isOverdue(dayKey);
            const isDayToday = dayKey === todayKey;

            return (
              <div key={dayKey} className="rounded-2xl border bg-white overflow-hidden">
                {/* Day header */}
                <div
                  className={`sticky top-0 z-10 px-6 py-4 border-b ${
                    overdue
                      ? "bg-red-50 border-red-200"
                      : isDayToday
                      ? "bg-blue-50 border-blue-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className={`text-lg font-semibold ${overdue ? "text-red-900" : "text-slate-900"}`}>
                        {formatDate(dayKey)}
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {formatDateShort(dayKey)} • {items.length} {items.length === 1 ? "acción" : "acciones"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {overdue && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 border border-red-200">
                          Vencida
                        </span>
                      )}
                      {isDayToday && !overdue && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
                          Hoy
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y">
                  {items.map((item) => (
                    <div key={item.id} className="px-6 py-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getTipoBadge(
                                item.tipo
                              )}`}
                            >
                              {item.tipo || "Acción"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {getOwnerLabel(item)} •{" "}
                              <span className="font-semibold text-slate-700">
                                {item.owner_name ?? "—"}
                              </span>
                            </span>
                          </div>

                          {item.nota && (
                            <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                              {item.nota}
                            </div>
                          )}

                          {item.lugar && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-slate-600">📍 {item.lugar}</span>
                              <a
                                href={buildMapsLink(item.lugar)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Maps
                              </a>
                              <span className="text-xs text-slate-400">•</span>
                              <a
                                href={buildWazeLink(item.lugar)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Waze
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            href={getOwnerLink(item)}
                            className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Abrir {getOwnerLabel(item)}
                          </Link>

                          <button
                            type="button"
                            disabled={markingId === item.id}
                            onClick={() => markAsDone(item)}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold border ${
                              markingId === item.id
                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                : "bg-slate-900 text-white border-slate-900 hover:opacity-95"
                            }`}
                          >
                            {markingId === item.id ? "Marcando..." : "Marcar realizada"}
                          </button>

                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => deleteActivity(item)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                              deletingId === item.id
                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                            }`}
                            title="Borrar actividad"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
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
