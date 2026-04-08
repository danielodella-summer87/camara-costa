"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { usePermissions } from "@/lib/rbac/usePermissions";
import { getLeadFlowSteps, getCurrentFlowStep, getLeadFlowProgressPercent, getLeadNextAction, LEAD_FLOW_LABELS } from "@/lib/leads/leadFlow";
import {
  badgeClassEstadoRevisionVisible,
  labelEstadoRevisionIniciativaVisible,
} from "@/lib/crm/iniciativaEstadoRevision";

type Lead = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;
  objetivos?: string | null;
  audiencia?: string | null;
  website?: string | null;
  linkedin_empresa?: string | null;
  ai_report?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  estado?: string | null;
  is_member?: boolean | null;
  member_since?: string | null;
  score?: number | null;
  comerciales?: { id: string; nombre: string } | null;
  empresas?: { instagram?: string | null; facebook?: string | null } | null;
  services_count?: number;
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

function getProgressBadgeClasses(percent: number): string {
  if (percent >= 75) return "bg-green-100 text-green-700";
  if (percent >= 40) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

// Componente para botón "Nuevo lead" con opciones
function NewLeadButton() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [showMenu, setShowMenu] = useState(false);
  const [showEmpresaSelector, setShowEmpresaSelector] = useState(false);
  /** 409 convert-to-lead: ya convertida o lead activo duplicado */
  const [duplicateConflict, setDuplicateConflict] = useState<{
    leadId: string;
    kind: "already_converted" | "active_exists";
  } | null>(null);

  // Si no tiene permiso de crear, no mostrar el botón
  if (!hasPermission("leads.create")) {
    return null;
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
        >
          Nuevo lead
          <span className="text-xs">▼</span>
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute top-full left-0 mt-1 z-20 rounded-xl border bg-white shadow-lg min-w-[180px]">
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowEmpresaSelector(true);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 rounded-t-xl"
              >
                Desde iniciativa
              </button>
              <Link
                href="/admin/leads/nuevo"
                onClick={() => setShowMenu(false)}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 rounded-b-xl"
              >
                Crear lead manual
              </Link>
            </div>
          </>
        )}
      </div>

      {duplicateConflict ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-lead-title"
          onClick={() => setDuplicateConflict(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="duplicate-lead-title" className="text-lg font-semibold text-slate-900">
              {duplicateConflict.kind === "active_exists"
                ? "Ya hay un lead activo"
                : "Iniciativa ya convertida"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {duplicateConflict.kind === "active_exists"
                ? "Con la configuración actual no se creó otro lead: existe uno activo para esta iniciativa. Abrí el lead existente o cerrá el pipeline del anterior (pipeline de cierre)."
                : "Esta iniciativa ya fue convertida a lead. No se creó un duplicado."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/admin/leads87/${duplicateConflict.leadId}`}
                onClick={() => setDuplicateConflict(null)}
                className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
              >
                Abrir en LEADS87
              </Link>
              <Link
                href={`/admin/leads/${duplicateConflict.leadId}`}
                onClick={() => setDuplicateConflict(null)}
                className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Ficha clásica
              </Link>
              <button
                type="button"
                onClick={() => setDuplicateConflict(null)}
                className="rounded-xl border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEmpresaSelector && (
        <IniciativaSelectorModal
          onClose={() => setShowEmpresaSelector(false)}
          onSelect={async (empresaId: string) => {
            setShowEmpresaSelector(false);
            try {
              const convRes = await fetch(`/api/admin/empresas/${encodeURIComponent(empresaId)}/convert-to-lead`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({}),
              });
              const convJson = await convRes.json().catch(() => ({}));
              const leadId = typeof convJson?.data?.lead_id === "string" ? convJson.data.lead_id.trim() : "";
              if (convRes.ok && leadId) {
                router.push(`/admin/leads87/${leadId}`);
                return;
              }
              if (convRes.status === 409 && leadId) {
                const kind =
                  convJson?.data?.code === "ACTIVE_LEAD_EXISTS" ? "active_exists" : "already_converted";
                setDuplicateConflict({ leadId, kind });
                return;
              }
              throw new Error(
                typeof convJson?.error === "string" ? convJson.error : "No se pudo convertir la iniciativa a lead."
              );
            } catch (e: any) {
              alert(e?.message ?? "Error al crear el lead desde la iniciativa");
            }
          }}
        />
      )}
    </>
  );
}

function IniciativaSelectorModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (iniciativaId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [iniciativas, setIniciativas] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIniciativas() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/empresas", {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Error cargando iniciativas");
        setIniciativas(Array.isArray(json?.data) ? json.data : []);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando iniciativas");
        setIniciativas([]);
      } finally {
        setLoading(false);
      }
    }
    fetchIniciativas();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return iniciativas;
    return iniciativas.filter((e) => {
      const haystack = [
        e.nombre ?? "",
        e.email ?? "",
        e.telefono ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [iniciativas, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-slate-900">Elegir iniciativa</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <div className="p-6 border-b">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar iniciativa por nombre, email o teléfono…"
            className="w-full rounded-xl border px-4 py-2 text-sm"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-sm text-slate-500">Cargando iniciativas...</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-500">
              {search ? "No se encontraron iniciativas con ese criterio." : "No hay iniciativas disponibles."}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onSelect(e.id)}
                  className="w-full text-left rounded-xl border p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">{e.nombre ?? "—"}</div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClassEstadoRevisionVisible(e.estado_revision, e.converted_lead_id)}`}
                    >
                      {labelEstadoRevisionIniciativaVisible(e.estado_revision, e.converted_lead_id)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {e.email && <span>{e.email}</span>}
                    {e.email && e.telefono && <span> · </span>}
                    {e.telefono && <span>{e.telefono}</span>}
                  </div>
                  {e.converted_lead_id ? (
                    <p className="mt-2 text-xs text-amber-800">Ya convertida: al elegirla se abrirá el lead existente.</p>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rows, setRows] = useState<Lead[]>([]);
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);

  // ✅ Permisos RBAC
  const { hasPermission } = usePermissions();

  const searchParams = useSearchParams();
  const empresaIdFromUrl = searchParams.get("empresa_id")?.trim() ?? null;

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
      const url = empresaIdFromUrl
        ? `/api/admin/leads?empresa_id=${encodeURIComponent(empresaIdFromUrl)}`
        : "/api/admin/leads";
      const res = await fetch(url, {
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
  }, [empresaIdFromUrl]);

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

    // Filtro de ganados: si showMembers es false, ocultar leads con pipeline = "Ganado"
    if (!showMembers) {
      list = list.filter((r) => (norm(r.pipeline) !== norm("Ganado")));
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

    // Deduplicación cuando showMembers === true
    if (showMembers) {
      const map = new Map<string, typeof list[number]>();

      for (const r of list) {
        const key =
          (r as any).empresa_id ??
          `${norm(r.nombre ?? "")}|${norm(r.email ?? "")}|${norm(r.telefono ?? "")}`;

        const prev = map.get(key);
        if (!prev) {
          map.set(key, r);
        } else {
          // preferir ganado
          const prevIsGanado = norm(prev.pipeline) === norm("Ganado");
          const rIsGanado = norm(r.pipeline) === norm("Ganado");
          if (!prevIsGanado && rIsGanado) map.set(key, r);
        }
      }

      list = Array.from(map.values());
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
            <h1 className="text-2xl font-semibold text-slate-900">Gestión operativa</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Leads: captura, origen, pipeline, notas y seguimiento.
            </p>
            {empresaIdFromUrl && (
              <p className="mt-1 text-sm text-slate-600">
                Filtrando por iniciativa{" "}
                <Link href="/admin/leads" className="text-blue-600 hover:underline">
                  (ver todos)
                </Link>
              </p>
            )}

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
                <span className="text-xs text-slate-700">Mostrar ganados</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NewLeadButton />

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

            {hasPermission("leads.write") && (
              <button
                type="button"
                onClick={bulkDelete}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={disabled || selectedCount === 0}
              >
                {mutating ? "…" : "Eliminar seleccionados"}
              </button>
            )}
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
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-10 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    <span className="sr-only">Selección</span>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Nombre
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Objetivo
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Progreso
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                    Siguiente paso
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-amber-700">
                    Pipeline (DEBUG)
                  </th>
                  <th className="w-20 px-3 py-2 text-right text-xs font-semibold text-slate-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
              {filtered.map((l) => {
                const checked = selectedIds.has(l.id);
                const leadForFlow = {
                  id: l.id,
                  nombre: l.nombre,
                  telefono: l.telefono,
                  email: l.email,
                  website: l.website,
                  objetivos: l.objetivos,
                  audiencia: l.audiencia,
                  linkedin_empresa: l.linkedin_empresa,
                  ai_report: l.ai_report,
                  empresas: l.empresas,
                };
                const servicesCount = l.services_count ?? 0;
                const steps = getLeadFlowSteps(leadForFlow, servicesCount);
                const currentStep = getCurrentFlowStep(steps);
                const progressPercent = getLeadFlowProgressPercent(steps);
                const tooltipLines = steps.map((s) => {
                  if (s.status === "done") return `✓ ${LEAD_FLOW_LABELS[s.id]}`;
                  if (s.status === "current") return `→ ${LEAD_FLOW_LABELS[s.id]}`;
                  return `○ ${LEAD_FLOW_LABELS[s.id]}`;
                });
                const tooltipText = `Avance del flujo: ${progressPercent}%\n\nFlujo del lead:\n${tooltipLines.join("\n")}`;
                const nextAction = getLeadNextAction(currentStep);

                return (
                  <tr
                    key={l.id}
                    className="group transition-colors hover:bg-slate-50 focus-within:bg-slate-50"
                  >
                    <td
                      className="px-3 py-2 align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(l.id)}
                        disabled={disabled}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Link
                        href={`/admin/leads/${l.id}`}
                        className="flex flex-wrap items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                      >
                        <span className={`font-semibold truncate ${norm(l.pipeline) === norm("Ganado") ? "text-emerald-700" : "text-slate-900"}`}>
                          {l.nombre ?? <span className="text-slate-400">—</span>}
                        </span>
                        {l.comerciales?.nombre && (
                          <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 whitespace-nowrap font-medium">
                            {l.comerciales.nombre}
                          </span>
                        )}
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          Etapa: {l.pipeline ?? "—"}
                        </span>
                      </Link>
                    </td>
                    <td
                      className="px-3 py-2 text-sm text-slate-700 max-w-[280px] truncate align-top"
                      title={l.objetivos || ""}
                    >
                      {l.objetivos?.trim() || "—"}
                    </td>
                    <td className="px-3 py-2 align-top" title={tooltipText}>
                      {currentStep ? (
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium flex-shrink-0 ${getProgressBadgeClasses(progressPercent)}`}>
                            [{progressPercent}%]
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                              currentStep.status === "done"
                                ? "bg-green-100 text-green-700"
                                : currentStep.status === "current"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span
                              className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                                currentStep.status === "done"
                                  ? "bg-green-500"
                                  : currentStep.status === "current"
                                  ? "bg-amber-500"
                                  : "bg-slate-400"
                              }`}
                              aria-hidden
                            />
                            <span className="truncate max-w-[140px] hidden sm:inline">{currentStep.label}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium flex-shrink-0 ${getProgressBadgeClasses(progressPercent)}`}>
                            [{progressPercent}%]
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
                            <span className="inline-block h-2 w-2 rounded-full bg-green-500 flex-shrink-0" aria-hidden />
                            <span className="truncate max-w-[140px] hidden sm:inline">Presentación lista</span>
                          </span>
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 align-top text-sm max-w-[200px] truncate"
                      title={currentStep ? `Paso actual del flujo: ${currentStep.label}` : "Flujo completo"}
                    >
                      {currentStep ? (
                        <span className="text-slate-700">
                          <span className="mr-1 opacity-70" aria-hidden>→</span>
                          {nextAction}
                        </span>
                      ) : (
                        <span className="text-green-700 font-medium">✓ Flujo completo</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs font-mono text-amber-800 bg-amber-50/50 rounded px-2 py-1" title="Campo pipeline (mismo que Kanban)">
                      {l.pipeline ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <Link
                        href={`/admin/leads/${l.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
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