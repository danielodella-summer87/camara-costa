"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";

type LeadOption = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  email: string | null;
  pipeline: string | null;
  empresas?: { nombre?: string | null } | null;
};

const CLOSED_PIPELINES = new Set(["ganado", "perdido", "cerrado", "no interesado"]);

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Normaliza pipeline para agrupar (minúsculas, sin acentos). */
function normPipeline(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const KANBAN_COLUMNS = ["Nuevo", "Contactado", "Investigación", "Diagnóstico", "Estrategia", "Servicios", "Propuesta", "Presentación", "Seguimiento"] as const;

/** Mapeo pipeline normalizado → nombre de columna kanban. */
const NORM_TO_KANBAN_COLUMN: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  investigacion: "Investigación",
  diagnostico: "Diagnóstico",
  estrategia: "Estrategia",
  servicios: "Servicios",
  propuesta: "Propuesta",
  presentacion: "Presentación",
  seguimiento: "Seguimiento",
};

function leadLabel(l: LeadOption): string {
  const empresa = l.empresas?.nombre?.trim();
  const contacto = l.contacto?.trim();
  const email = l.email?.trim();
  const nombre = l.nombre?.trim();
  const part = empresa || contacto || email || nombre || "Sin nombre";
  return part;
}

function cell(value: string | null | undefined): string {
  const v = value?.trim();
  return v ?? "—";
}

type ViewMode = "kanban" | "listado";

const PIPELINE_FILTER_OPTIONS = ["Todos", ...KANBAN_COLUMNS];

export default function OportunidadesPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("listado");
  const [selectedPipeline, setSelectedPipeline] = useState("Todos");
  const [searchText, setSearchText] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingLeads(true);
    fetch("/api/admin/leads", { cache: "no-store", headers: { "Cache-Control": "no-store" } })
      .then(async (res) => {
        const json = (await res.json()) as { data?: LeadOption[]; error?: string };
        if (!res.ok) throw new Error(json?.error ?? "Error cargando leads");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        const data = Array.isArray(json?.data) ? json.data : [];
        const active = data.filter((l) => l?.id && !CLOSED_PIPELINES.has(norm(l.pipeline)));
        setLeads(active);
      })
      .catch(() => {
        if (!cancelled) setLeads([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLeads(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = () => {
    if (!selectedLeadId?.trim()) return;
    router.push(`/admin/oportunidades/${encodeURIComponent(selectedLeadId)}`);
  };

  const handleKanbanDragStart = (e: React.DragEvent, leadId: string, sourcePipeline: string | null) => {
    setDragError(null);
    e.dataTransfer.setData("application/json", JSON.stringify({ leadId, sourcePipeline }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleKanbanDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleKanbanDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    let data: { leadId: string; sourcePipeline: string | null };
    try {
      data = JSON.parse(e.dataTransfer.getData("application/json"));
    } catch {
      return;
    }
    const { leadId, sourcePipeline } = data;
    if (!leadId || !targetColumn) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (normPipeline(lead.pipeline) === normPipeline(targetColumn)) return;

    const previousLeads = leads.slice();
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipeline: targetColumn } : l)));

    const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ pipeline: targetColumn }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setLeads(previousLeads);
      setDragError(json?.error ?? "Error al actualizar la etapa");
    }
  };

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (selectedPipeline !== "Todos") {
      const targetNorm = normPipeline(selectedPipeline);
      list = list.filter((l) => normPipeline(l.pipeline) === targetNorm);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter((l) => {
        const empresa = (l.empresas?.nombre ?? l.nombre ?? "").toLowerCase();
        const contacto = (l.contacto ?? "").toLowerCase();
        const email = (l.email ?? "").toLowerCase();
        return empresa.includes(q) || contacto.includes(q) || email.includes(q);
      });
    }
    if (onlyMine) {
      // Placeholder: no hay owner en LeadOption por ahora; no filtrar
    }
    return list;
  }, [leads, selectedPipeline, searchText, onlyMine]);

  const leadsByColumn = useMemo(() => {
    const map: Record<string, LeadOption[]> = {};
    KANBAN_COLUMNS.forEach((col) => {
      map[col] = [];
    });
    map["Otros"] = [];
    for (const l of filteredLeads) {
      const key = NORM_TO_KANBAN_COLUMN[normPipeline(l.pipeline)] ?? "Otros";
      if (!map[key]) map[key] = [];
      map[key].push(l);
    }
    return map;
  }, [filteredLeads]);

  const summaryMetrics = useMemo(() => {
    let enPropuesta = 0;
    let enSeguimiento = 0;
    let nuevas = 0;
    for (const l of filteredLeads) {
      const n = normPipeline(l.pipeline);
      if (n === "nuevo") nuevas++;
      else if (n === "propuesta") enPropuesta++;
      else if (n === "seguimiento") enSeguimiento++;
    }
    return {
      activas: filteredLeads.length,
      enPropuesta,
      enSeguimiento,
      nuevas,
    };
  }, [filteredLeads]);

  return (
    <PageContainer>
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold text-slate-900">Oportunidades</h1>
        <p className="mt-2 text-sm text-slate-600">Vista maestra comercial</p>
      </div>

      {/* Abrir oportunidad */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Abrir oportunidad</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            disabled={loadingLeads}
            className="min-w-[240px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">
              {loadingLeads ? "Cargando leads..." : "Seleccioná un lead activo"}
            </option>
            {filteredLeads.map((l) => (
              <option key={l.id} value={l.id}>
                {leadLabel(l)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleOpen}
            disabled={!selectedLeadId?.trim()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            Abrir oportunidad
          </button>
        </div>
      </div>

      {/* Barra de control: vista Kanban / Listado + Nuevo lead */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${viewMode === "kanban" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setViewMode("listado")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${viewMode === "listado" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Listado
          </button>
        </div>
        {/* Mismo flujo que Leads: ruta dedicada /admin/leads/nuevo */}
        <Link
          href="/admin/leads/nuevo"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          title="Crear lead (formulario de Leads)"
        >
          Nuevo lead
        </Link>
      </div>

      {/* Resumen de métricas */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Oportunidades activas</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : summaryMetrics.activas}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En propuesta</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : summaryMetrics.enPropuesta}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">En seguimiento</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : summaryMetrics.enSeguimiento}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nuevas</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">{loadingLeads ? "—" : summaryMetrics.nuevas}</p>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Pipeline</label>
          <select
            value={selectedPipeline}
            onChange={(e) => setSelectedPipeline(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            {PIPELINE_FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar empresa, contacto o email"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="rounded border-slate-300 text-slate-800 focus:ring-slate-400"
          />
          <span className="text-sm text-slate-700">Solo mis leads</span>
        </label>
      </div>

      {/* Contenido según vista activa */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {viewMode === "kanban" && (
          <>
            {loadingLeads ? (
              <div className="p-8 text-sm text-slate-600">Cargando oportunidades...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-sm text-slate-600">Ninguna oportunidad coincide con los filtros.</div>
            ) : (
              <>
                {dragError && (
                  <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {dragError}
                  </div>
                )}
                <div className="flex gap-4 overflow-x-auto p-4 min-h-[320px] select-none">
                  {KANBAN_COLUMNS.map((col) => {
                    const columnLeads = leadsByColumn[col] ?? [];
                    return (
                      <div
                        key={col}
                        className="flex-shrink-0 w-[280px] rounded-lg border border-slate-200 bg-slate-50/80 select-none"
                        onDragOver={handleKanbanDragOver}
                        onDrop={(e) => handleKanbanDrop(e, col)}
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 select-none">
                          <h3 className="text-sm font-semibold text-slate-800 select-none">{col}</h3>
                          <span className="text-xs text-slate-500 select-none">{columnLeads.length}</span>
                        </div>
                        <div className="p-2 space-y-2 overflow-y-auto max-h-[70vh] select-none">
                          {columnLeads.map((l) => (
                            <div
                              key={l.id}
                              draggable
                              onDragStart={(e) => handleKanbanDragStart(e, l.id, l.pipeline)}
                              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm select-none cursor-grab active:cursor-grabbing"
                            >
                              <p className="text-sm font-medium text-slate-800 truncate select-none" title={cell(l.empresas?.nombre ?? l.nombre)}>
                                {cell(l.empresas?.nombre ?? l.nombre)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-600 truncate select-none" title={cell(l.contacto)}>
                                {cell(l.contacto)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-600 truncate select-none" title={cell(l.email)}>
                                {cell(l.email)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 select-none">{cell(l.pipeline)}</p>
                              <Link
                                href={`/admin/oportunidades/${encodeURIComponent(l.id)}`}
                                draggable={false}
                                className="mt-2 inline-block rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 select-none"
                              >
                                Abrir oportunidad
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {(leadsByColumn["Otros"]?.length ?? 0) > 0 && (
                    <div className="flex-shrink-0 w-[280px] rounded-lg border border-slate-200 bg-slate-50/80 select-none">
                      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 select-none">
                        <h3 className="text-sm font-semibold text-slate-800 select-none">Otros</h3>
                        <span className="text-xs text-slate-500 select-none">{leadsByColumn["Otros"].length}</span>
                      </div>
                      <div className="p-2 space-y-2 overflow-y-auto max-h-[70vh] select-none">
                        {leadsByColumn["Otros"].map((l) => (
                          <div
                            key={l.id}
                            draggable
                            onDragStart={(e) => handleKanbanDragStart(e, l.id, l.pipeline)}
                            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm select-none cursor-grab active:cursor-grabbing"
                          >
                            <p className="text-sm font-medium text-slate-800 truncate select-none" title={cell(l.empresas?.nombre ?? l.nombre)}>
                              {cell(l.empresas?.nombre ?? l.nombre)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600 truncate select-none" title={cell(l.contacto)}>
                              {cell(l.contacto)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600 truncate select-none" title={cell(l.email)}>
                              {cell(l.email)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 select-none">{cell(l.pipeline)}</p>
                            <Link
                              href={`/admin/oportunidades/${encodeURIComponent(l.id)}`}
                              draggable={false}
                              className="mt-2 inline-block rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 select-none"
                            >
                              Abrir oportunidad
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {viewMode === "listado" && (
          <>
            {loadingLeads ? (
              <div className="p-8 text-sm text-slate-600">Cargando oportunidades...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-sm text-slate-600">Sin oportunidades activas o ninguna coincide con los filtros.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Empresa</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Contacto</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Pipeline</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredLeads.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-800">{cell(l.empresas?.nombre ?? l.nombre)}</td>
                        <td className="px-4 py-3 text-slate-600">{cell(l.contacto)}</td>
                        <td className="px-4 py-3 text-slate-600">{cell(l.email)}</td>
                        <td className="px-4 py-3 text-slate-600">{cell(l.pipeline)}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/oportunidades/${encodeURIComponent(l.id)}`}
                            className="inline-flex rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                          >
                            Abrir oportunidad
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
