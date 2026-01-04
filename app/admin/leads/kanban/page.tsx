"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
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
};

type PipelineRow = {
  id: string;
  nombre: string;
  posicion: number;
  color: string | null;
  created_at?: string;
  updated_at?: string;
};

type ApiResp<T> = {
  data?: T | null;
  error?: string | null;
};

const NONE_COLUMN_ID = "__none__";

const BASE_PIPELINES = [
  { nombre: "Nuevo", color: "#22c55e" },
  { nombre: "Contactado", color: "#3b82f6" },
  { nombre: "En seguimiento", color: "#a855f7" },
  { nombre: "Calificado", color: "#f59e0b" },
  { nombre: "No interesado", color: "#ef4444" },
  { nombre: "Cerrado", color: "#64748b" },
];

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function pickInitials(name: string) {
  const n = (name ?? "").trim();
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

type Column = {
  id: string;
  nombre: string;
  color: string;
  isNone?: boolean;
};

export default function LeadsKanbanPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  // Orden local de cards por columna (no persiste aún, pero mantiene tu orden en pantalla)
  const [cardOrder, setCardOrder] = useState<Record<string, string[]>>({});

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

      // inicializar/normalizar orden local
      setCardOrder((prev) => {
        const next = { ...prev };
        const colIds = [...pData.map((p) => p.id), NONE_COLUMN_ID];

        // asegurar arrays por columna
        for (const cid of colIds) if (!next[cid]) next[cid] = [];

        // agrupar leads por columna (mapeo por nombre)
        const nameToId = new Map<string, string>();
        pData.forEach((p) => nameToId.set(norm(p.nombre), p.id));

        const byCol: Record<string, string[]> = {};
        for (const cid of colIds) byCol[cid] = [];

        for (const ld of lData) {
          const pid = nameToId.get(norm(ld.pipeline)) ?? NONE_COLUMN_ID;
          byCol[pid].push(ld.id);
        }

        // merge: respeta orden previo si existe
        for (const cid of colIds) {
          const prevList = next[cid] ?? [];
          const newSet = new Set(byCol[cid]);

          const merged: string[] = [];
          for (const id of prevList) if (newSet.has(id)) merged.push(id);
          for (const id of byCol[cid]) if (!merged.includes(id)) merged.push(id);

          next[cid] = merged;
        }

        // limpiar ids que ya no existen
        const allLeadIds = new Set(lData.map((x) => x.id));
        for (const cid of colIds) {
          next[cid] = (next[cid] ?? []).filter((id) => allLeadIds.has(id));
        }

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

  const columns: Column[] = useMemo(() => {
    const cols: Column[] = pipelines.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      color: safeColor(p.color),
    }));

    cols.push({
      id: NONE_COLUMN_ID,
      nombre: "Sin pipeline",
      color: "#e2e8f0",
      isNone: true,
    });

    return cols;
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

  async function persistLeadPipeline(leadId: string, targetColumnId: string) {
    const target = columns.find((c) => c.id === targetColumnId);
    const pipelineValue = target?.isNone ? null : target?.nombre ?? null;

    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ pipeline: pipelineValue }),
    });

    const json = (await res.json()) as ApiResp<Lead>;
    if (!res.ok) throw new Error(json?.error ?? "Error actualizando lead");

    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipeline: pipelineValue } : l)));
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

  function resolveOverColumn(e: DragOverEvent | DragEndEvent): string | null {
    if (!e.over) return null;

    const overType = e.over.data.current?.type as string | undefined;
    const overId = String(e.over.id);

    // cuando el mouse está “sobre la columna”
    if (overType === "column") return overId;

    // cuando está sobre el droppable interior de la columna (zona vacía)
    if (overType === "column-drop") {
      return (e.over.data.current?.columnId as string) ?? null;
    }

    // cuando está sobre una card
    if (overType === "card") return findColumnIdByCardId(overId);

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

    // preview: mover optimista a otra columna (al inicio)
    setCardOrder((prev) => {
      const next = { ...prev };
      const from = [...(next[fromCol] ?? [])].filter((x) => x !== activeId);
      const to = [...(next[toCol] ?? [])];

      next[fromCol] = from;
      next[toCol] = [activeId, ...to.filter((x) => x !== activeId)];
      return next;
    });
  }

  async function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const activeType = e.active.data.current?.type as string | undefined;

    if (!e.over) return;

    // 1) COLUMNAS (reorden horizontal)
    if (activeType === "column") {
      const overType = e.over.data.current?.type as string | undefined;
      if (overType !== "column") return;

      const overId = String(e.over.id);

      // No permitir mover “Sin pipeline”
      if (activeId === NONE_COLUMN_ID || overId === NONE_COLUMN_ID) return;

      const fromIndex = columnIds.indexOf(activeId);
      const toIndex = columnIds.indexOf(overId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

      const newCols = arrayMove(columns, fromIndex, toIndex);

      // asegurar NONE al final
      const fixed = [
        ...newCols.filter((c) => c.id !== NONE_COLUMN_ID),
        newCols.find((c) => c.id === NONE_COLUMN_ID)!,
      ];

      // actualizar UI (pipelines) optimista
      setPipelines((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        const onlyPipes = fixed.filter((c) => c.id !== NONE_COLUMN_ID);
        return onlyPipes.map((c, idx) => ({
          ...(map.get(c.id)!),
          posicion: idx,
        }));
      });

      setBusy(true);
      setError(null);
      try {
        const orderIds = fixed.filter((c) => c.id !== NONE_COLUMN_ID).map((c) => c.id);
        await persistColumnOrder(orderIds);
      } catch (err: any) {
        setError(err?.message ?? "No se pudo guardar el orden");
        await fetchAll();
      } finally {
        setBusy(false);
      }
      return;
    }

    // 2) CARDS (mover/reordenar)
    if (activeType === "card") {
      const overType = e.over.data.current?.type as string | undefined;
      const fromCol = findColumnIdByCardId(activeId);
      const toCol = resolveOverColumn(e);

      if (!fromCol || !toCol) return;

      // reorder dentro de la misma columna (cuando suelto sobre otra card)
      if (toCol === fromCol && overType === "card") {
        const overId = String(e.over.id);

        setCardOrder((prev) => {
          const next = { ...prev };
          const full = [...(next[fromCol] ?? [])];
          const oldIndex = full.indexOf(activeId);
          const newIndex = full.indexOf(overId);
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
          next[fromCol] = arrayMove(full, oldIndex, newIndex);
          return next;
        });

        return;
      }

      // cambio de columna -> persistir
      setBusy(true);
      setError(null);
      try {
        await persistLeadPipeline(activeId, toCol);
      } catch (err: any) {
        setError(err?.message ?? "No se pudo mover el lead");
        await fetchAll();
      } finally {
        setBusy(false);
      }
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

  async function addColumnFromUI() {
    const nombre = window.prompt("Nombre de la columna (pipeline):");
    if (!nombre) return;

    const color = window.prompt("Color HEX (opcional). Ej: #3b82f6", "#3b82f6") ?? "";
    const c = color.trim();
    const finalColor = c.length ? c : null;

    setBusy(true);
    setError(null);
    try {
      await createPipeline(nombre.trim(), finalColor);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? "Error creando columna");
    } finally {
      setBusy(false);
    }
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

            {/* Toggle Lista/Kanban (se mantiene también en la vista Lista cuando apliques el otro archivo) */}
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
            <button
              type="button"
              onClick={addColumnFromUI}
              disabled={loading || busy}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              title="Crear una columna nueva"
            >
              + Columna
            </button>

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

        <div className="mt-5 flex items-center justify-between gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="w-full max-w-md rounded-xl border px-4 py-2 text-sm"
          />
          <div className="text-xs text-slate-500">
            Tip: scroll horizontal con trackpad (2 dedos) o Shift + rueda.
          </div>
        </div>

        {/* ✅ BOARD: scroll X (abajo) + Y (derecha) real */}
        <div className="mt-5 rounded-2xl border bg-white">
          <div className="p-4">
            <div
              className="max-h-[70vh] overflow-auto pb-4"
              style={{ scrollbarGutter: "stable both-edges" as any }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                {/* columnas sortable */}
                <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                  <div className="flex min-w-max gap-4 pr-10">
                    {columns.map((col) => (
                      <KanbanColumn
                        key={col.id}
                        column={col}
                        leadsIds={cardsByColumn[col.id] ?? []}
                        leadById={leadById}
                        disabled={loading || busy}
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
          <span className="font-semibold">pipeline</span> como texto (mapeamos por nombre). Si querés, próximo paso lo
          pasamos a relación por id.
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
}: {
  column: Column;
  leadsIds: string[];
  leadById: Map<string, Lead>;
  disabled: boolean;
}) {
  const sortable = useSortable({
    id: column.id,
    disabled: disabled || column.id === NONE_COLUMN_ID, // no mover Sin pipeline
    data: { type: "column" },
  });

  // droppable dedicado para poder soltar en columna vacía
  const drop = useDroppable({
    id: `drop-${column.id}`,
    disabled,
    data: { type: "column-drop", columnId: column.id },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div ref={sortable.setNodeRef} style={style} className="w-[300px] shrink-0 rounded-2xl border bg-white">
      {/* header: handle de drag de columna */}
      <div
        className="flex items-center justify-between gap-2 rounded-t-2xl border-b px-3 py-2"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} aria-hidden />
          <div className="font-semibold text-slate-900">{column.nombre}</div>
          <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{leadsIds.length}</span>
        </div>

        {!column.isNone && <span className="text-xs text-slate-400">⠿</span>}
      </div>

      <div className="p-3">
        <div
          ref={drop.setNodeRef}
          className={`min-h-[140px] rounded-2xl p-2 ${drop.isOver ? "bg-slate-100" : "bg-slate-50"}`}
        >
          {/* cards sortable (vertical) */}
          <SortableContext items={leadsIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {leadsIds.length === 0 ? (
                <div className="rounded-xl border bg-white px-3 py-2 text-xs text-slate-500">Soltá acá para mover</div>
              ) : (
                leadsIds.map((id) => {
                  const lead = leadById.get(id);
                  if (!lead) return null;
                  return <LeadCard key={id} lead={lead} disabled={disabled} />;
                })
              )}
            </div>
          </SortableContext>
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, disabled }: { lead: Lead; disabled: boolean }) {
  const s = useSortable({
    id: lead.id,
    disabled,
    data: { type: "card" },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(s.transform),
    transition: s.transition,
  };

  const nombre = lead.nombre ?? "—";
  const contacto = lead.contacto ?? "—";
  const origen = lead.origen ?? "—";
  const telefono = lead.telefono ?? null;
  const email = lead.email ?? null;
  const notas = lead.notas ?? null;

  return (
    <div ref={s.setNodeRef} style={style} {...s.attributes} {...s.listeners} className="rounded-2xl border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{nombre}</div>
          <div className="mt-0.5 text-sm text-slate-600">{contacto}</div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-slate-50 text-xs font-semibold text-slate-700">
          {pickInitials(nombre)}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{origen}</span>
        {telefono && (
          <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{telefono}</span>
        )}
        {email && <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{email}</span>}
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