"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Rubro = {
  id: string;
  nombre: string;
  created_at?: string;
};

type ApiList = { data?: Rubro[]; error?: string | null };
type ApiOne = { data?: Rubro | null; error?: string | null };

function norm(s: string) {
  return s.trim().toLowerCase();
}

export default function RubrosAdminPage() {
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Rubro[]>([]);
  const [q, setQ] = useState("");

  // crear
  const [newNombre, setNewNombre] = useState("");

  // editar inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNombre, setEditingNombre] = useState("");

  async function fetchRubros() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/rubros", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiList;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando rubros");

      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando rubros");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function createRubro() {
    const nombre = newNombre.trim();
    if (!nombre) return;

    setError(null);
    setMutatingId("new");

    try {
      const res = await fetch("/api/admin/rubros", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ nombre }),
      });

      const json = (await res.json()) as ApiOne;
      if (!res.ok) throw new Error(json?.error ?? "Error creando rubro");

      setNewNombre("");
      await fetchRubros();
    } catch (e: any) {
      setError(e?.message ?? "Error creando rubro");
    } finally {
      setMutatingId(null);
    }
  }

  async function updateRubro(id: string, nombre: string) {
    const clean = nombre.trim();
    if (!clean) return;

    setError(null);
    setMutatingId(id);

    try {
      const res = await fetch(`/api/admin/rubros/${id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ nombre: clean }),
      });

      const json = (await res.json()) as ApiOne;
      if (!res.ok) throw new Error(json?.error ?? "Error actualizando rubro");

      setEditingId(null);
      setEditingNombre("");
      await fetchRubros();
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando rubro");
    } finally {
      setMutatingId(null);
    }
  }

  async function deleteRubro(id: string) {
    setError(null);
    setMutatingId(id);

    try {
      const res = await fetch(`/api/admin/rubros/${id}`, {
        method: "DELETE",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiOne;
      if (!res.ok) throw new Error(json?.error ?? "Error eliminando rubro");

      await fetchRubros();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando rubro");
    } finally {
      setMutatingId(null);
    }
  }

  useEffect(() => {
    fetchRubros();
  }, []);

  const filtered = useMemo(() => {
    const term = norm(q);
    const list = [...rows].sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
    if (!term) return list;
    return list.filter((r) => norm(r.nombre ?? "").includes(term));
  }, [rows, q]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Rubros</h1>
            <p className="mt-1 text-sm text-slate-600">
              Administrá los rubros que aparecen en Entidades.
            </p>
          </div>

          <Link
            href="/admin/configuracion"
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
          >
            Volver
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar rubro..."
            className="w-full rounded-xl border px-4 py-2 text-sm md:max-w-md"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchRubros}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={loading || !!mutatingId}
            >
              Refrescar
            </button>
          </div>
        </div>

        {/* crear */}
        <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-600">Nuevo rubro</div>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Ej: Construcción"
              className="w-full rounded-xl border px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={createRubro}
              disabled={!newNombre.trim() || mutatingId === "new"}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-white disabled:opacity-50"
            >
              {mutatingId === "new" ? "…" : "Crear"}
            </button>
          </div>
        </div>

        {/* listado */}
        <div className="mt-5 overflow-hidden rounded-2xl border">
          <div className="grid grid-cols-[1fr_220px] bg-white px-4 py-3 text-xs font-semibold text-slate-600">
            <div>Nombre</div>
            <div className="text-right">Acción</div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">No hay rubros.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const busy = mutatingId === r.id;
                const editing = editingId === r.id;

                return (
                  <div key={r.id} className="grid grid-cols-[1fr_220px] items-center px-4 py-3">
                    <div>
                      {!editing ? (
                        <div className="text-sm font-medium text-slate-900">{r.nombre}</div>
                      ) : (
                        <input
                          value={editingNombre}
                          onChange={(e) => setEditingNombre(e.target.value)}
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {!editing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(r.id);
                              setEditingNombre(r.nombre ?? "");
                            }}
                            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                            disabled={busy || loading}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteRubro(r.id)}
                            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                            disabled={busy || loading}
                            title="Eliminar rubro"
                          >
                            Eliminar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => updateRubro(r.id, editingNombre)}
                            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                            disabled={busy || loading || !editingNombre.trim() || norm(editingNombre) === norm(r.nombre ?? "")}
                          >
                            {busy ? "…" : "Guardar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditingNombre("");
                            }}
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
          Nota: si eliminás un rubro que está usado por empresas, puede fallar por restricción. Si querés, hacemos “soft delete”.
        </div>
      </div>
    </div>
  );
}