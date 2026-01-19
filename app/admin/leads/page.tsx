"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

type Lead = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  estado?: string | null;
  is_member?: boolean | null;
  member_since?: string | null;
};

type PipelineRow = {
  id: string;
  nombre: string;
  posicion: number;
  color: string | null;
  created_at?: string;
  updated_at?: string;
};

type LeadsApiResponse = {
  data?: Lead[] | null;
  error?: string | null;
};

type PipelinesApiResponse = {
  data?: PipelineRow[] | null;
  error?: string | null;
};

type BulkPatchResponse = {
  data?: { updated: number; rows: { id: string; pipeline?: string | null; updated_at?: string | null }[] } | null;
  error?: string | null;
};

type BulkDeleteResponse = {
  data?: { deleted: number; ids: string[] } | null;
  error?: string | null;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function csvEscape(v: unknown) {
  const s = safeStr(v);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatLocalFilenameDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}_${hh}${mi}`;
}

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rows, setRows] = useState<Lead[]>([]);
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);

  // filtros
  const [q, setQ] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState<string>("Todos");
  const [showMembers, setShowMembers] = useState(false); // default OFF

  // selección masiva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPipeline, setBulkPipeline] = useState<string>("");

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function fetchPipelines() {
    try {
      const res = await fetch("/api/admin/leads/pipelines", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = (await res.json()) as PipelinesApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando pipelines");

      const list = Array.isArray(json?.data) ? json.data : [];
      list.sort((a, b) => (a.posicion ?? 0) - (b.posicion ?? 0));
      setPipelines(list);
    } catch {
      // si falla, no bloqueamos la vista lista
      setPipelines([]);
    }
  }

  async function fetchLeads() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/leads", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as LeadsApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando leads");

      const list = Array.isArray(json?.data) ? (json.data as Lead[]) : [];
      setRows(list);

      // si un lead ya no está, lo sacamos de la selección
      setSelectedIds((prev) => {
        if (!prev.size) return prev;
        const ids = new Set(list.map((x) => x.id));
        const next = new Set<string>();
        prev.forEach((id) => {
          if (ids.has(id)) next.add(id);
        });
        return next;
      });
    } catch (e: any) {
      setError(e?.message ?? "Error cargando leads");
      setRows([]);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([fetchPipelines(), fetchLeads()]);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pipelineOptions = useMemo(() => {
    // usamos pipelines de DB para que aparezcan aunque no tengan leads todavía
    const names = pipelines.map((p) => p.nombre).filter(Boolean);
    const unique = Array.from(new Set(names.map((x) => x.trim()).filter(Boolean)));

    // también contemplamos pipelines que existan en leads pero no estén en la tabla (por si hay legado)
    const fromLeads = new Set<string>();
    rows.forEach((r) => {
      const p = (r.pipeline ?? "").trim();
      if (p) fromLeads.add(p);
    });

    const merged = Array.from(new Set([...unique, ...Array.from(fromLeads)])).sort((a, b) =>
      a.localeCompare(b)
    );

    return ["Todos", ...merged, "Sin pipeline"];
  }, [pipelines, rows]);

  const bulkPipelineOptions = useMemo(() => {
    const names = pipelines.map((p) => p.nombre).filter(Boolean);
    const unique = Array.from(new Set(names.map((x) => x.trim()).filter(Boolean)));
    // fallback “clásicos” por si todavía no tenés pipelines
    const fallback = ["Nuevo", "Contactado", "En seguimiento", "Calificado", "No interesado", "Cerrado"];
    const merged = Array.from(new Set([...unique, ...fallback])).sort((a, b) => a.localeCompare(b));
    return merged;
  }, [pipelines]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = [...rows];

    // Filtro de socios: si showMembers es false, ocultar leads con is_member=true
    if (!showMembers) {
      list = list.filter((r) => !r.is_member);
    }

    if (pipelineFilter !== "Todos") {
      if (pipelineFilter === "Sin pipeline") {
        list = list.filter((r) => !norm(r.pipeline));
      } else {
        list = list.filter((r) => norm(r.pipeline) === norm(pipelineFilter));
      }
    }

    if (term.length) {
      list = list.filter((r) => {
        const haystack = [
          r.nombre ?? "",
          r.contacto ?? "",
          r.email ?? "",
          r.telefono ?? "",
          r.origen ?? "",
          r.pipeline ?? "",
          r.notas ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    list.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") * -1);
    return list;
  }, [rows, q, pipelineFilter, showMembers]);

  const selectedCount = selectedIds.size;

  const allFilteredSelected = useMemo(() => {
    if (!filtered.length) return false;
    return filtered.every((r) => selectedIds.has(r.id));
  }, [filtered, selectedIds]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelectAll = !filtered.every((r) => next.has(r.id));
      if (shouldSelectAll) {
        filtered.forEach((r) => next.add(r.id));
      } else {
        filtered.forEach((r) => next.delete(r.id));
      }
      return next;
    });
  }

  async function bulkUpdatePipeline() {
    setError(null);

    const ids = Array.from(selectedIds);
    if (!ids.length) {
      setError("Seleccioná al menos 1 lead.");
      return;
    }

    const p = bulkPipeline.trim();
    if (!p) {
      setError("Elegí un pipeline para aplicar.");
      return;
    }

    setMutating(true);
    try {
      const res = await fetch("/api/admin/leads/bulk", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ ids, pipeline: p }),
      });

      const json = (await res.json()) as BulkPatchResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error en bulk update");

      flash(`Pipeline actualizado (${json?.data?.updated ?? 0}).`);
      await fetchLeads();
      setBulkPipeline("");
      setSelectedIds(new Set());
    } catch (e: any) {
      setError(e?.message ?? "Error en bulk update");
    } finally {
      setMutating(false);
    }
  }

  async function bulkDelete() {
    setError(null);

    const ids = Array.from(selectedIds);
    if (!ids.length) {
      setError("Seleccioná al menos 1 lead.");
      return;
    }

    const ok = window.confirm(`¿Eliminar ${ids.length} lead(s)? Esta acción no se puede deshacer.`);
    if (!ok) return;

    setMutating(true);
    try {
      const res = await fetch("/api/admin/leads/bulk", {
        method: "DELETE",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ ids }),
      });

      const json = (await res.json()) as BulkDeleteResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error eliminando");

      flash(`Eliminados: ${json?.data?.deleted ?? 0}`);
      await fetchLeads();
      setSelectedIds(new Set());
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando");
    } finally {
      setMutating(false);
    }
  }

  function exportCSV() {
    setError(null);

    const exportRows =
      selectedCount > 0 ? filtered.filter((r) => selectedIds.has(r.id)) : filtered;

    if (!exportRows.length) {
      setError("No hay leads para exportar (con esos filtros/selección).");
      return;
    }

    const sep = ";";
    const header = [
      "id",
      "nombre",
      "contacto",
      "telefono",
      "email",
      "origen",
      "pipeline",
      "estado",
      "notas",
      "created_at",
      "updated_at",
    ];

    const lines: string[] = [];
    lines.push(header.map(csvEscape).join(sep));

    exportRows.forEach((r) => {
      const row = [
        r.id,
        r.nombre ?? "",
        r.contacto ?? "",
        r.telefono ?? "",
        r.email ?? "",
        r.origen ?? "",
        r.pipeline ?? "",
        r.estado ?? "",
        r.notas ?? "",
        r.created_at ?? "",
        r.updated_at ?? "",
      ];
      lines.push(row.map(csvEscape).join(sep));
    });

    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;

    const namePart = formatLocalFilenameDate();
    const scope = selectedCount > 0 ? `seleccion_${selectedCount}` : `filtrados_${exportRows.length}`;
    a.download = `leads_${scope}_${namePart}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    flash(
      `CSV exportado: ${
        selectedCount > 0 ? `${selectedCount} seleccionados` : `${exportRows.length} filtrados`
      }`
    );
  }

  const disabled = loading || mutating;

  return (
    <PageContainer>
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Captura, origen, pipeline, notas y seguimiento. (A = texto)
            </p>

            {/* ✅ Switch en modo LISTA */}
            <div className="mt-3 flex items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-xl border bg-white">
                <span className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-900">
                  Lista
                </span>
                <Link
                  href="/admin/leads/kanban"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  Kanban
                </Link>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMembers}
                  onChange={(e) => setShowMembers(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-700">Mostrar socios</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/leads/nuevo"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Nuevo lead
            </Link>

            <Link
              href="/admin/leads/importar"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Importar
            </Link>

            <button
              type="button"
              onClick={exportCSV}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={disabled}
              title={selectedCount > 0 ? "Exporta seleccionados" : "Exporta filtrados"}
            >
              Exportar CSV
            </button>

            <button
              type="button"
              onClick={refreshAll}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={disabled}
            >
              Refrescar
            </button>
          </div>
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {notice}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* filtros */}
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, contacto, email, teléfono, origen, pipeline..."
            className="w-full rounded-xl border px-4 py-2 text-sm md:max-w-xl"
          />

          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="text-xs font-semibold text-slate-600">Pipeline</div>
            <select
              value={pipelineFilter}
              onChange={(e) => setPipelineFilter(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
              disabled={disabled}
            >
              {pipelineOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* acciones masivas */}
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            Seleccionados: <span className="font-semibold">{selectedCount}</span>
            {selectedCount > 0 ? (
              <button
                type="button"
                className="ml-2 rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                onClick={() => setSelectedIds(new Set())}
                disabled={disabled}
              >
                Limpiar
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkPipeline}
              onChange={(e) => setBulkPipeline(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
              disabled={disabled}
            >
              <option value="">Cambiar pipeline…</option>
              {bulkPipelineOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={bulkUpdatePipeline}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={disabled || selectedCount === 0 || !bulkPipeline.trim()}
            >
              {mutating ? "…" : "Aplicar"}
            </button>

            <button
              type="button"
              onClick={bulkDelete}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={disabled || selectedCount === 0}
            >
              {mutating ? "…" : "Eliminar seleccionados"}
            </button>
          </div>
        </div>

        {/* tabla */}
        <div className="mt-5">
          {/* Mini encabezado con conteo */}
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              {filtered.length} {filtered.length === 1 ? "lead" : "leads"}
              {selectedCount > 0 && ` · ${selectedCount} seleccionado${selectedCount > 1 ? "s" : ""}`}
            </span>
          </div>
          
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {loading ? (
              <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">No hay leads para mostrar.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filtered.map((l) => {
                  const checked = selectedIds.has(l.id);

                  return (
                    <div
                      key={l.id}
                      className="group relative flex items-center gap-4 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 focus-within:bg-slate-50 md:min-h-[56px]"
                    >
                      {/* Checkbox - no navega */}
                      <div
                        className="flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(l.id)}
                          disabled={disabled}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                        />
                      </div>

                      {/* Fila clickeable - navega al lead */}
                      <Link
                        href={`/admin/leads/${l.id}`}
                        className="flex flex-1 items-center gap-4 min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                        onClick={(e) => {
                          // Si el click viene del checkbox o botones, no navegar
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                              (e.target as HTMLElement).closest('button') ||
                              (e.target as HTMLElement).closest('a[href*="/admin/leads/"]')) {
                            e.preventDefault();
                          }
                        }}
                      >
                        {/* Desktop: Layout horizontal completo */}
                        <div className="hidden md:flex flex-1 items-center gap-6 min-w-0">
                          {/* Columna izquierda: Empresa + Contacto */}
                          <div className="flex min-w-0 flex-col gap-0.5 flex-[2]">
                            <div className="truncate font-semibold text-slate-900">
                              {l.nombre ?? <span className="text-slate-400">—</span>}
                            </div>
                            {l.contacto && (
                              <div className="truncate text-xs text-slate-500">{l.contacto}</div>
                            )}
                          </div>

                          {/* Centro: Email + Teléfono */}
                          <div className="flex min-w-0 flex-col gap-0.5 flex-[2]">
                            {l.email && (
                              <div
                                className="truncate text-sm text-slate-700"
                                title={l.email}
                              >
                                {l.email}
                              </div>
                            )}
                            {l.telefono && (
                              <div className="truncate text-sm text-slate-700">{l.telefono}</div>
                            )}
                            {!l.email && !l.telefono && (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>

                          {/* Derecha: Chips + Botón */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {l.origen && (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                                {l.origen}
                              </span>
                            )}
                            {l.pipeline && (
                              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                {l.pipeline}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mobile: Layout compacto 2 líneas */}
                        <div className="flex md:hidden flex-1 flex-col gap-2 min-w-0">
                          {/* Línea 1: Empresa + Acción */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-col gap-0.5 flex-1">
                              <div className="truncate font-semibold text-slate-900">
                                {l.nombre ?? <span className="text-slate-400">—</span>}
                              </div>
                              {l.contacto && (
                                <div className="truncate text-xs text-slate-500">{l.contacto}</div>
                              )}
                            </div>
                          </div>
                          {/* Línea 2: Email/Teléfono + Chips */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-col gap-0.5 flex-1">
                              {l.email && (
                                <div
                                  className="truncate text-xs text-slate-600"
                                  title={l.email}
                                >
                                  {l.email}
                                </div>
                              )}
                              {l.telefono && (
                                <div className="truncate text-xs text-slate-600">{l.telefono}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {l.origen && (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                  {l.origen}
                                </span>
                              )}
                              {l.pipeline && (
                                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                  {l.pipeline}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>

                      {/* Botón Ver - no navega desde el Link padre */}
                      <div
                        className="flex items-center flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          href={`/admin/leads/${l.id}`}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
                        >
                          Ver
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Tip: Exportar CSV usa separador <span className="font-semibold">;</span> + BOM UTF-8 para que Excel lo abra bien.
        </div>
      </div>
    </PageContainer>
  );
}