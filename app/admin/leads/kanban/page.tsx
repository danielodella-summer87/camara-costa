"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

type NextActivityType =
  | "none"
  | "call"
  | "meeting"
  | "proposal"
  | "whatsapp"
  | "email"
  | "followup";

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

  // ✅ nuevos
  rating?: number | null;
  next_activity_type?: NextActivityType | string | null;
  next_activity_at?: string | null;
  estado?: string | null;
};

type PipelineRow = {
  id: string;
  nombre: string;
  posicion: number;
  tipo: "normal" | "ganado" | "perdido";
  color: string | null;
  created_at?: string;
  updated_at?: string;
};

type ApiResp<T> = {
  data?: T | null;
  error?: string | null;
};


function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function pickInitials(name: string) {
  const n = name.trim();
  if (!n) return "L";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "L";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function safeColor(c: string | null | undefined) {
  const s = (c ?? "").trim();
  return s.length ? s : "#e2e8f0";
}

function clampRating(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.trunc(n)));
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("es-UY", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function activityMeta(t: unknown) {
  const type = typeof t === "string" ? t.toLowerCase().trim() : "";
  switch (type) {
    case "call":
      return { label: "Llamada", icon: "📞", cls: "bg-blue-50 text-blue-700 border-blue-200" };
    case "meeting":
      return { label: "Reunión", icon: "🤝", cls: "bg-violet-50 text-violet-700 border-violet-200" };
    case "proposal":
      return { label: "Propuesta", icon: "📄", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    case "whatsapp":
      return { label: "WhatsApp", icon: "💬", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "email":
      return { label: "Email", icon: "✉️", cls: "bg-slate-50 text-slate-700 border-slate-200" };
    case "followup":
      return { label: "Seguimiento", icon: "🔁", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    case "none":
    default:
      return { label: "Sin próxima", icon: "⏳", cls: "bg-slate-50 text-slate-700 border-slate-200" };
  }
}

type Column = {
  id: string; // pipeline id
  nombre: string;
  color: string;
};

type ActiveDrag =
  | { type: "column"; id: string }
  | { type: "card"; id: string }
  | null;

const BASE_PIPELINES = [
  { nombre: "Nuevo", color: "#22c55e" },
  { nombre: "Contactado", color: "#3b82f6" },
  { nombre: "En seguimiento", color: "#a855f7" },
  { nombre: "Calificado", color: "#f59e0b" },
  { nombre: "No interesado", color: "#ef4444" },
  { nombre: "Cerrado", color: "#64748b" },
];

export default function LeadsKanbanPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  // orden local de cards por columna
  const [cardOrder, setCardOrder] = useState<Record<string, string[]>>({});
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);

  // ✅ Estados para feedback visual de guardado
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [lastSavedEtapa, setLastSavedEtapa] = useState<string | null>(null);

  // ✅ anti-loop: evita setState repetido en preview move durante drag
  const lastPreviewMoveRef = useRef<{ cardId: string; toCol: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function fetchAll() {
    setError(null);
    setLoading(true);
    try {
      const [pRes, lRes] = await Promise.all([
        fetch("/api/admin/leads/pipelines", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        }),
        fetch("/api/admin/leads", {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        }),
      ]);

      const pJson = (await pRes.json()) as ApiResp<PipelineRow[]>;
      const lJson = (await lRes.json()) as ApiResp<Lead[]>;

      if (!pRes.ok) throw new Error(pJson?.error ?? "Error cargando pipelines");
      if (!lRes.ok) throw new Error(lJson?.error ?? "Error cargando leads");

      const pData = Array.isArray(pJson?.data) ? pJson.data : [];
      const lData = Array.isArray(lJson?.data) ? lJson.data : [];

      pData.sort((a, b) => (a.posicion ?? 0) - (b.posicion ?? 0));

      setPipelines(pData);
      setLeads(lData);

      // inicializar orden local de cards por columna (si no existe aún)
      setCardOrder((prev) => {
        const next = { ...prev };
        const colIds = pData.map((p) => p.id);

        for (const cid of colIds) if (!next[cid]) next[cid] = [];

        const byCol: Record<string, string[]> = {};
        for (const cid of colIds) byCol[cid] = [];

        const nameToId = new Map<string, string>();
        pData.forEach((p) => nameToId.set(norm(p.nombre), p.id));

        // Buscar pipeline "Nuevo" para asignar leads sin pipeline
        const nuevoPipeline = pData.find((p) => norm(p.nombre) === "nuevo");
        const nuevoId = nuevoPipeline?.id;

        for (const ld of lData) {
          // Asignar "Nuevo" si no tiene pipeline (solo para render, no se guarda)
          const normalizedPipeline = ld.pipeline ?? "Nuevo";
          const pid = nameToId.get(norm(normalizedPipeline)) ?? nuevoId;
          if (pid) {
            byCol[pid].push(ld.id);
          }
        }

        for (const cid of colIds) {
          const prevList = next[cid] ?? [];
          const newSet = new Set(byCol[cid]);

          const merged: string[] = [];
          for (const id of prevList) if (newSet.has(id)) merged.push(id);
          for (const id of byCol[cid]) if (!merged.includes(id)) merged.push(id);

          next[cid] = merged;
        }

        const allLeadIds = new Set(lData.map((x) => x.id));
        for (const cid of colIds) next[cid] = next[cid].filter((id) => allLeadIds.has(id));

        return next;
      });
    } catch (e: any) {
      setError(e?.message ?? "Error cargando datos");
      setPipelines([]);
      setLeads([]);
      setCardOrder({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // Limpiar "Guardado" después de 2s
  useEffect(() => {
    if (!lastSavedId) return;
    const t = setTimeout(() => setLastSavedId(null), 2000);
    return () => clearTimeout(t);
  }, [lastSavedId]);

  // Limpiar notice después de 3s
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const columns: Column[] = useMemo(() => {
    return pipelines.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      color: safeColor(p.color),
    }));
  }, [pipelines]);

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const filteredLeads = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return leads;

    return leads.filter((l) => {
      const hay = [
        l.nombre ?? "",
        l.contacto ?? "",
        l.email ?? "",
        l.telefono ?? "",
        l.origen ?? "",
        l.pipeline ?? "",
        l.notas ?? "",
        String(l.rating ?? ""),
        String(l.next_activity_type ?? ""),
        String(l.next_activity_at ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [leads, q]);

  const leadById = useMemo(() => {
    const m = new Map<string, Lead>();
    filteredLeads.forEach((l) => m.set(l.id, l));
    return m;
  }, [filteredLeads]);

  const cardsByColumn = useMemo(() => {
    const allowed = new Set(filteredLeads.map((l) => l.id));
    const result: Record<string, string[]> = {};

    for (const cid of columnIds) {
      const list = cardOrder[cid] ?? [];
      result[cid] = list.filter((id) => allowed.has(id));
    }

    return result;
  }, [cardOrder, columnIds, filteredLeads]);

  async function persistEtapa(leadId: string, etapa: string) {
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ pipeline: etapa }), // ← IGUAL que ficha lead
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Error guardando etapa");
    return json;
  }

  async function persistLeadPipeline(leadId: string, targetColumnId: string) {
    const target = columns.find((c) => c.id === targetColumnId);
    const pipelineValue = target?.nombre ?? "Nuevo";

    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ pipeline: pipelineValue }),
    });

    const json = (await res.json()) as ApiResp<Lead>;
    if (!res.ok) throw new Error(json?.error ?? "Error actualizando lead");

    // si el API devuelve el lead actualizado, lo usamos
    if (json?.data) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...(json.data as Lead) } : l)));
    } else {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipeline: pipelineValue } : l)));
    }
  }

  async function patchLeadMeta(
    leadId: string,
    patch: Partial<Pick<Lead, "rating" | "next_activity_type" | "next_activity_at">>
  ) {
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(patch),
    });

    const json = (await res.json()) as ApiResp<Lead>;
    if (!res.ok) throw new Error(json?.error ?? "Error actualizando lead");

    if (json?.data) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...(json.data as Lead) } : l)));
    } else {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...patch } : l)));
    }
  }

  async function persistColumnOrder(newPipelineIdsInOrder: string[]) {
    const res = await fetch("/api/admin/leads/pipelines", {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ order: newPipelineIdsInOrder }),
    });
    const json = (await res.json()) as ApiResp<any>;
    if (!res.ok) throw new Error(json?.error ?? "Error guardando orden");
  }

  function findColumnIdByCardId(cardId: string) {
    for (const cid of columnIds) {
      const list = cardsByColumn[cid] ?? [];
      if (list.includes(cardId)) return cid;
    }
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const t = e.active.data.current?.type as string | undefined;
    if (t === "column") setActiveDrag({ type: "column", id });
    else setActiveDrag({ type: "card", id });
  }

  function resolveOverColumn(e: DragOverEvent | DragEndEvent): string | null {
    const over = e.over;
    if (!over) return null;

    const overType = over.data.current?.type as string | undefined;

    // Caso 1: si estoy sobre una columna
    if (overType === "column") return String(over.id);

    // Caso 2: si estoy sobre una card, la columna es la de esa card
    if (overType === "card") {
      return findColumnIdByCardId(String(over.id));
    }

    // Caso 3: si estoy sobre un "dropzone" dentro de la columna
    // (suele venir con data.current.columnId o pipelineId)
    const columnId =
      (over.data.current as any)?.columnId ??
      (over.data.current as any)?.pipelineId ??
      (over.data.current as any)?.containerId;

    if (columnId) return String(columnId);

    // Caso 4 (fallback): si el id del droppable coincide con un column id
    const overId = String(over.id);
    if (columnIds.includes(overId)) return overId;

    return null;
  }

  function handleDragOver(e: DragOverEvent) {
    const activeType = e.active.data.current?.type as string | undefined;
    if (activeType !== "card") return;

    const activeId = String(e.active.id);
    const fromCol = findColumnIdByCardId(activeId);
    if (!fromCol) return;

    const toCol = resolveOverColumn(e);
    if (!toCol || toCol === fromCol) return;

    // ✅ anti-loop: si ya hicimos este preview move, no lo repitas
    const last = lastPreviewMoveRef.current;
    if (last?.cardId === activeId && last?.toCol === toCol) return;

    setCardOrder((prev) => {
      const fromList = prev[fromCol] ?? [];
      const toList = prev[toCol] ?? [];

      // ✅ si ya está “como queremos” (no está en from y está primero en to), no updates
      const alreadyMoved = !fromList.includes(activeId) && toList[0] === activeId;
      if (alreadyMoved) return prev;

      const next = { ...prev };
      next[fromCol] = fromList.filter((x) => x !== activeId);
      next[toCol] = [activeId, ...toList.filter((x) => x !== activeId)];
      return next;
    });

    lastPreviewMoveRef.current = { cardId: activeId, toCol };
  }

  async function handleDragEnd(e: DragEndEvent) {
    // ✅ Log para debug
    console.log("[KANBAN] dragEnd", {
      activeId: String(e.active?.id),
      activeType: e.active?.data?.current?.type,
      overId: e.over ? String(e.over.id) : null,
      overType: e.over?.data?.current?.type,
    });

    // ✅ limpiar preview para evitar loops en próximos drags
    lastPreviewMoveRef.current = null;

    const activeId = String(e.active.id);
    const activeType = e.active.data.current?.type as string | undefined;
    if (!e.over) {
      setActiveDrag(null);
      return;
    }

    // 1) columnas
    if (activeType === "column") {
      const overType = e.over.data.current?.type as string | undefined;
      if (overType !== "column") {
        setActiveDrag(null);
        return;
      }

      const fromIndex = columnIds.indexOf(activeId);
      const toIndex = columnIds.indexOf(String(e.over.id));

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        setActiveDrag(null);
        return;
      }

      const newCols = arrayMove(columns, fromIndex, toIndex);

      setPipelines((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        return newCols.map((c, idx) => ({
          ...(map.get(c.id)!),
          posicion: idx,
        }));
      });

      setBusy(true);
      setError(null);
      try {
        const orderIds = newCols.map((c) => c.id);
        await persistColumnOrder(orderIds);
      } catch (err: any) {
        setError(err?.message ?? "No se pudo guardar el orden");
        await fetchAll();
      } finally {
        setBusy(false);
        setActiveDrag(null);
      }
      return;
    }

    // 2) cards
    if (activeType === "card") {
      const activeId = String(e.active.id);

      const fromCol = findColumnIdByCardId(activeId);

      const overId = String(e.over.id);
      const overCardCol = findColumnIdByCardId(overId);
      const toCol = overCardCol ?? resolveOverColumn(e);

      if (!fromCol || !toCol) {
        setActiveDrag(null);
        return;
      }

      // Si es la misma columna, no persistir
      if (fromCol === toCol) {
        setActiveDrag(null);
        return;
      }

      const targetColumn = columns.find((c) => c.id === toCol);
      const targetEtapaNombre = targetColumn?.nombre ?? "Nuevo";

      setBusy(true);
      setSavingId(activeId);
      setError(null);
      setNotice(null);

      try {
        await persistEtapa(activeId, targetEtapaNombre);

        setLeads((prev) =>
          prev.map((l) =>
            l.id === activeId ? { ...l, pipeline: targetEtapaNombre } : l
          )
        );

        setNotice(`Etapa guardada: ${targetEtapaNombre}`);

        await fetchAll();
      } catch (err: any) {
        setError(err?.message ?? "No se pudo mover el lead");
        await fetchAll();
      } finally {
        setBusy(false);
        setSavingId(null);
        setActiveDrag(null);
      }

      return;
    }
  }

  async function createPipeline(nombre: string, color?: string | null) {
    const res = await fetch("/api/admin/leads/pipelines", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        nombre,
        color: color ?? null,
      }),
    });

    const json = (await res.json()) as ApiResp<PipelineRow>;
    if (!res.ok) throw new Error(json?.error ?? "No se pudo crear la columna");
  }


  async function ensureBaseColumns() {
    setBusy(true);
    setError(null);
    try {
      const existing = new Set(pipelines.map((p) => norm(p.nombre)));
      for (const bp of BASE_PIPELINES) {
        if (!existing.has(norm(bp.nombre))) {
          await createPipeline(bp.nombre, bp.color);
        }
      }
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? "Error creando columnas base");
    } finally {
      setBusy(false);
    }
  }

  const showBaseHint = pipelines.length < 5;

  return (
    <PageContainer>
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Leads · Kanban</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Vista por pipeline (drag & drop cards + reorden de columnas).
            </p>

            <div className="mt-3 inline-flex overflow-hidden rounded-xl border bg-white">
              <Link
                href="/admin/leads"
                className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
              >
                Lista
              </Link>
              <span className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-900">
                Kanban
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showBaseHint && (
              <button
                type="button"
                onClick={ensureBaseColumns}
                disabled={loading || busy}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                title="Crea las columnas típicas si faltan"
              >
                Columnas base
              </button>
            )}

            <Link
              href="/admin/leads/importar"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Importar
            </Link>

            <Link
              href="/admin/leads/nuevo"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Nuevo lead
            </Link>

            <button
              type="button"
              onClick={fetchAll}
              disabled={loading || busy}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Refrescar
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {busy && (
          <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Guardando cambios…
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="w-full max-w-md rounded-xl border px-4 py-2 text-sm"
          />
          <div className="text-xs text-slate-500">
            Tip: scroll horizontal con trackpad (2 dedos) o Shift + rueda.
          </div>
        </div>

        <div className="mt-5 rounded-2xl border bg-white">
          <div className="p-4">
            <div
              className="max-h-[70vh] overflow-auto pb-4"
              style={{ scrollbarGutter: "stable both-edges" as any }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                  <div className="flex w-max gap-4 pr-10">
                    {columns.map((col) => (
                      <KanbanColumn
                        key={col.id}
                        column={col}
                        leadsIds={cardsByColumn[col.id] ?? []}
                        leadById={leadById}
                        disabled={loading || busy}
                        savingId={savingId}
                        lastSavedId={lastSavedId}
                        onPatchLead={async (id, patch) => {
                          setBusy(true);
                          setError(null);
                          try {
                            await patchLeadMeta(id, patch);
                          } catch (e: any) {
                            setError(e?.message ?? "No se pudo actualizar el lead");
                            await fetchAll();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Nota: columnas desde <span className="font-semibold">leads_pipelines</span>, leads guardan{" "}
          <span className="font-semibold">pipeline</span> como texto (mapeamos por nombre). Si querés,
          próximo paso lo pasamos a relación por id.
        </div>
      </div>
    </PageContainer>
  );
}

function KanbanColumn({
  column,
  leadsIds,
  leadById,
  disabled,
  savingId,
  lastSavedId,
  onPatchLead,
}: {
  column: Column;
  leadsIds: string[];
  leadById: Map<string, Lead>;
  disabled: boolean;
  savingId: string | null;
  lastSavedId: string | null;
  onPatchLead: (
    leadId: string,
    patch: Partial<Pick<Lead, "rating" | "next_activity_type" | "next_activity_at">>
  ) => Promise<void>;
}) {
  const sortable = useSortable({
    id: column.id,
    disabled: disabled,
    data: { type: "column" },
  });

  const drop = useDroppable({
    id: `drop-${column.id}`,
    disabled,
    data: { type: "column-drop", columnId: column.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  const count = leadsIds.length;

  return (
    <div ref={sortable.setNodeRef} style={style} className="w-[320px] shrink-0 rounded-2xl border bg-white">
      <div
        className="flex items-center justify-between gap-2 rounded-t-2xl border-b px-3 py-2"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} aria-hidden />
          <span className="text-xs text-slate-400">▼</span>
          <div className="font-semibold text-slate-900">{column.nombre}</div>
          <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
            {count}
          </span>
        </div>

        <span className="text-xs text-slate-400">⠿</span>
      </div>

      <div className="p-3">
        <div
          ref={drop.setNodeRef}
          className={`min-h-[140px] rounded-2xl p-2 ${drop.isOver ? "bg-slate-100" : "bg-slate-50"}`}
        >
          <SortableContext items={leadsIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {leadsIds.length === 0 ? (
                <div className="rounded-xl border bg-white px-3 py-2 text-xs text-slate-500">
                  Soltá acá para mover
                </div>
              ) : (
                leadsIds.map((id) => {
                  const lead = leadById.get(id);
                  if (!lead) return null;
                  return (
                    <LeadCard
                      key={id}
                      lead={lead}
                      disabled={disabled}
                      savingId={savingId}
                      lastSavedId={lastSavedId}
                      onPatchLead={onPatchLead}
                    />
                  );
                })
              )}
            </div>
          </SortableContext>
        </div>
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  disabled,
  savingId,
  lastSavedId,
  onPatchLead,
}: {
  lead: Lead;
  disabled: boolean;
  savingId: string | null;
  lastSavedId: string | null;
  onPatchLead: (
    leadId: string,
    patch: Partial<Pick<Lead, "rating" | "next_activity_type" | "next_activity_at">>
  ) => Promise<void>;
}) {
  const s = useSortable({
    id: lead.id,
    disabled,
    data: { type: "card" },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(s.transform),
    transition: s.transition,
  };

  const nombre = lead.nombre ?? "—";
  const contacto = lead.contacto ?? "—";
  const origen = lead.origen ?? "—";
  const telefono = lead.telefono ?? null;
  const email = lead.email ?? null;
  const notas = lead.notas ?? null;

  const rating = clampRating(lead.rating ?? 0);
  const act = activityMeta(lead.next_activity_type);
  const actAt = formatDateTime(lead.next_activity_at);

  async function setRating(next: number) {
    if (disabled) return;
    await onPatchLead(lead.id, { rating: next });
  }

  // evita que al tocar estrellas se dispare drag
  function stop(e: any) {
    e.stopPropagation?.();
  }

  return (
    <div
      ref={s.setNodeRef}
      style={style}
      {...s.attributes}
      {...s.listeners}
      className="rounded-2xl border bg-white p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate flex items-center gap-1">
            {nombre}
            {savingId === lead.id && (
              <span className="ml-2 text-xs text-slate-500">Guardando…</span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-slate-600 truncate">{contacto}</div>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-slate-50 text-xs font-semibold text-slate-700">
          {pickInitials(nombre)}
        </div>
      </div>

      {/* ✅ rating + próxima actividad */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-1"
          onPointerDown={stop}
          onMouseDown={stop}
          onClick={stop}
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const v = i + 1;
            const filled = v <= rating;
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                onClick={() => setRating(v)}
                className={`text-sm leading-none ${filled ? "text-amber-500" : "text-slate-300"} disabled:opacity-50`}
                title={`Importancia: ${v}/5`}
              >
                ★
              </button>
            );
          })}
        </div>

        <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${act.cls}`}>
          <span aria-hidden>{act.icon}</span>
          <span className="font-medium">{act.label}</span>
          {actAt && <span className="opacity-80">· {actAt}</span>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
          {origen}
        </span>
        {telefono && (
          <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
            {telefono}
          </span>
        )}
        {email && (
          <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
            {email}
          </span>
        )}
      </div>

      {notas && <div className="mt-2 text-xs text-slate-500 line-clamp-2">{notas}</div>}

      <div className="mt-3 flex justify-end">
        <Link
          href={`/admin/leads/${lead.id}`}
          className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Ver
        </Link>
      </div>
    </div>
  );
}