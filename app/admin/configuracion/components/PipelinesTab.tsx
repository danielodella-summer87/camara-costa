"use client";

import { useEffect, useState } from "react";

type Pipeline = {
  id: string;
  nombre: string;
  posicion: number;
  tipo: "normal" | "ganado" | "perdido";
  color: string | null;
  created_at?: string;
  updated_at?: string;
};

type ApiList = { data?: Pipeline[]; error?: string | null };
type ApiOne = { data?: Pipeline | null; error?: string | null };

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export default function PipelinesTab() {
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Pipeline[]>([]);

  // crear
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newTipo, setNewTipo] = useState<"normal" | "ganado" | "perdido">("normal");
  const [newColor, setNewColor] = useState("");

  // editar
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNombre, setEditingNombre] = useState("");
  const [editingTipo, setEditingTipo] = useState<"normal" | "ganado" | "perdido">("normal");
  const [editingColor, setEditingColor] = useState("");

  async function fetchPipelines() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/leads/pipelines", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiList;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando etapas");

      const list = Array.isArray(json?.data) ? json.data : [];
      list.sort((a, b) => a.posicion - b.posicion);
      setRows(list);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando etapas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function createPipeline() {
    const nombre = newNombre.trim();
    if (!nombre) return;

    setError(null);
    setMutatingId("new");

    try {
      const res = await fetch("/api/admin/leads/pipelines", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          nombre,
          tipo: newTipo,
          color: newColor.trim() || null,
        }),
      });

      const json = (await res.json()) as ApiOne;
      if (!res.ok) throw new Error(json?.error ?? "Error creando etapa");

      setNewNombre("");
      setNewTipo("normal");
      setNewColor("");
      setShowCreateModal(false);
      await fetchPipelines();
    } catch (e: any) {
      setError(e?.message ?? "Error creando etapa");
    } finally {
      setMutatingId(null);
    }
  }

  async function updatePipeline(id: string) {
    const nombre = editingNombre.trim();
    if (!nombre) return;

    setError(null);
    setMutatingId(id);

    try {
      const res = await fetch(`/api/admin/leads/pipelines/${id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          nombre,
          tipo: editingTipo,
          color: editingColor.trim() || null,
        }),
      });

      const json = (await res.json()) as ApiOne;
      if (!res.ok) throw new Error(json?.error ?? "Error actualizando etapa");

      setEditingId(null);
      setEditingNombre("");
      setEditingTipo("normal");
      setEditingColor("");
      await fetchPipelines();
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando etapa");
    } finally {
      setMutatingId(null);
    }
  }

  async function deletePipeline(id: string) {
    const pipeline = rows.find((r) => r.id === id);
    if (!pipeline) return;

    const ok = window.confirm(
      `¿Eliminar la etapa "${pipeline.nombre}"?\n\nSi hay leads usando esta etapa, no se podrá eliminar.`
    );
    if (!ok) return;

    setError(null);
    setMutatingId(id);

    try {
      const res = await fetch(`/api/admin/leads/pipelines/${id}`, {
        method: "DELETE",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiOne;
      if (!res.ok) throw new Error(json?.error ?? "Error eliminando etapa");

      await fetchPipelines();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando etapa");
    } finally {
      setMutatingId(null);
    }
  }

  async function movePipeline(id: string, direction: "up" | "down") {
    const index = rows.findIndex((r) => r.id === id);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rows.length) return;

    const target = rows[newIndex];
    const current = rows[index];

    setError(null);
    setMutatingId(id);

    try {
      // Intercambiar posiciones
      const currentPos = current.posicion;
      const targetPos = target.posicion;

      // Actualizar ambas etapas
      await Promise.all([
        fetch(`/api/admin/leads/pipelines/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ posicion: targetPos }),
        }),
        fetch(`/api/admin/leads/pipelines/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ posicion: currentPos }),
        }),
      ]);

      await fetchPipelines();
    } catch (e: any) {
      setError(e?.message ?? "Error moviendo etapa");
    } finally {
      setMutatingId(null);
    }
  }

  function startEdit(pipeline: Pipeline) {
    setEditingId(pipeline.id);
    setEditingNombre(pipeline.nombre);
    setEditingTipo(pipeline.tipo);
    setEditingColor(pipeline.color || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingNombre("");
    setEditingTipo("normal");
    setEditingColor("");
  }

  useEffect(() => {
    fetchPipelines();
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Etapas de leads</h2>
            <p className="mt-1 text-xs text-slate-600">
              Administrá las etapas del proceso comercial del lead. "Nuevo" es el default para nuevos leads. "Ganado" y "Perdido" son finales.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            disabled={loading || !!mutatingId}
          >
            + Crear etapa
          </button>
        </div>

        {/* listado */}
        <div className="mt-5 overflow-hidden rounded-2xl border">
          <div className="grid grid-cols-[1fr_120px_100px_200px] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            <div>Nombre</div>
            <div>Tipo</div>
            <div>Color</div>
            <div className="text-right">Acción</div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">No hay etapas creadas.</div>
          ) : (
            <div className="divide-y">
              {rows.map((p, index) => {
                const busy = mutatingId === p.id;
                const editing = editingId === p.id;
                const isSystem = norm(p.nombre) === "nuevo" || norm(p.nombre) === "ganado" || norm(p.nombre) === "perdido";

                return (
                  <div key={p.id} className="grid grid-cols-[1fr_120px_100px_200px] items-center px-4 py-3">
                    {/* Nombre */}
                    <div>
                      {!editing ? (
                        <div className="text-sm font-medium text-slate-900">
                          {p.nombre}
                          {isSystem && (
                            <span className="ml-2 text-xs text-slate-500">(sistema)</span>
                          )}
                        </div>
                      ) : (
                        <input
                          value={editingNombre}
                          onChange={(e) => setEditingNombre(e.target.value)}
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          disabled={busy}
                        />
                      )}
                    </div>

                    {/* Tipo */}
                    <div>
                      {!editing ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            p.tipo === "ganado"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.tipo === "perdido"
                              ? "bg-red-100 text-red-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {p.tipo === "ganado" ? "Ganado" : p.tipo === "perdido" ? "Perdido" : "Normal"}
                        </span>
                      ) : (
                        <select
                          value={editingTipo}
                          onChange={(e) => setEditingTipo(e.target.value as "normal" | "ganado" | "perdido")}
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          disabled={busy}
                        >
                          <option value="normal">Normal</option>
                          <option value="ganado">Ganado</option>
                          <option value="perdido">Perdido</option>
                        </select>
                      )}
                    </div>

                    {/* Color */}
                    <div>
                      {!editing ? (
                        <div className="flex items-center gap-2">
                          {p.color ? (
                            <>
                              <div
                                className="h-6 w-6 rounded border"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="text-xs text-slate-600">{p.color}</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={editingColor}
                          onChange={(e) => setEditingColor(e.target.value)}
                          placeholder="#000000"
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          disabled={busy}
                        />
                      )}
                    </div>

                    {/* Acción */}
                    <div className="flex items-center justify-end gap-2">
                      {!editing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                            disabled={busy || loading}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => deletePipeline(p.id)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                            disabled={busy || loading || isSystem}
                            title={isSystem ? "No se puede eliminar (etapa del sistema)" : "Eliminar etapa"}
                          >
                            Eliminar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => updatePipeline(p.id)}
                            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                            disabled={busy || loading || !editingNombre.trim()}
                          >
                            {busy ? "…" : "Guardar"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                            disabled={busy || loading}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-slate-500">
          <p>• "Nuevo" es la etapa por defecto para nuevos leads.</p>
          <p>• Solo puede haber una etapa de tipo "Ganado" y una de tipo "Perdido".</p>
          <p>• No se pueden eliminar las etapas del sistema (Nuevo, Ganado, Perdido).</p>
          <p>• Si una etapa está en uso por leads, no se puede eliminar.</p>
        </div>
      </div>

      {/* Modal crear */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Crear etapa</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewNombre("");
                  setNewTipo("normal");
                  setNewColor("");
                }}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  placeholder="Ej: Enviar propuesta"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Tipo *
                </label>
                <select
                  value={newTipo}
                  onChange={(e) => setNewTipo(e.target.value as "normal" | "ganado" | "perdido")}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="normal">Normal</option>
                  <option value="ganado">Ganado</option>
                  <option value="perdido">Perdido</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Solo puede haber una etapa "Ganado" y una "Perdido".
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Color (opcional)
                </label>
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="#3B82F6"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Código hexadecimal (ej: #3B82F6)
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewNombre("");
                    setNewTipo("normal");
                    setNewColor("");
                  }}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={createPipeline}
                  disabled={!newNombre.trim() || mutatingId === "new"}
                  className="rounded-xl border bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {mutatingId === "new" ? "Creando…" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
