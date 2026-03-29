"use client";

import { useMemo, useState } from "react";
import type { CategoryRow, PromptRow } from "./types";
import { categoryPastelSurfaceClass, getCategoryPastelClasses } from "./categoryPastel";

export function CategoryManager({
  categories,
  prompts = [],
  onCreate,
  onUpdate,
  saving,
}: {
  categories: CategoryRow[];
  /** Para mostrar cantidad de prompts por categoría. */
  prompts?: PromptRow[];
  onCreate: (payload: { name: string; description: string; is_active: boolean }) => Promise<void>;
  onUpdate: (id: string, payload: { name: string; description: string; is_active: boolean }) => Promise<void>;
  saving: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => categories.find((c) => c.id === editingId) ?? null, [categories, editingId]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const promptCountByCategoryId = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prompts) {
      if (p.id === "__new__") continue;
      const cid = (p.category_id ?? "").trim();
      if (!cid) continue;
      m.set(cid, (m.get(cid) ?? 0) + 1);
    }
    return m;
  }, [prompts]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setModalOpen(true);
  }

  function openEdit(c: CategoryRow) {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description ?? "");
    setIsActive(c.is_active);
    setModalOpen(true);
  }

  async function submit() {
    if (!name.trim()) return;
    if (editing) await onUpdate(editing.id, { name: name.trim(), description, is_active: isActive });
    else await onCreate({ name: name.trim(), description, is_active: isActive });
    setModalOpen(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Categorías</h3>
        <button
          type="button"
          data-ia-categories-new
          onClick={openCreate}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
        >
          Nueva categoría
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {categories.map((c) => {
          const pastel = getCategoryPastelClasses(c.name);
          const surface = categoryPastelSurfaceClass(c.name);
          const n = promptCountByCategoryId.get(c.id) ?? 0;
          return (
            <div
              key={c.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${surface}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-medium ${pastel.text}`}>{c.name}</p>
                  <span className="shrink-0 rounded-full bg-white/85 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-black/10">
                    {n} {n === 1 ? "prompt" : "prompts"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600">{c.description || "Sin descripción"}</p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(c)}
                className="ml-2 shrink-0 rounded border border-slate-300 bg-white/90 px-2 py-1 text-xs hover:bg-white"
              >
                Editar
              </button>
            </div>
          );
        })}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-4 shadow-lg">
            <h4 className="text-sm font-semibold text-slate-900">{editing ? "Editar categoría" : "Nueva categoría"}</h4>
            <label className="mt-3 block text-xs text-slate-700">
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
            <label className="mt-3 block text-xs text-slate-700">
              Descripción
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} />
            </label>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Activa
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded border px-3 py-2 text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" onClick={() => void submit()} disabled={saving || !name.trim()} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
