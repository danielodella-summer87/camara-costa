"use client";

import { useEffect, useMemo, useState } from "react";

type Rubro = {
  id: string;
  nombre: string;
  created_at?: string;
};

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

function cleanStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export default function RubrosTable() {
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Rubro[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");

  async function fetchRubros() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/rubros", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResponse<Rubro[]>;

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
    const nombre = cleanStr(nuevoNombre);
    if (!nombre) {
      setError("Ingresá un nombre de rubro.");
      return;
    }

    setError(null);
    setCreating(true);

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

      const json = (await res.json()) as ApiResponse<Rubro>;

      if (!res.ok) throw new Error(json?.error ?? "Error creando rubro");

      setNuevoNombre("");
      await fetchRubros();
    } catch (e: any) {
      setError(e?.message ?? "Error creando rubro");
    } finally {
      setCreating(false);
    }
  }

  async function patchRubro(id: string, payload: { nombre: string }) {
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
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ApiResponse<Rubro>;

      if (!res.ok) throw new Error(json?.error ?? "Error actualizando rubro");

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

      const json = (await res.json()) as ApiResponse<{ ok: true }>;

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

  const rubrosOrdenados = useMemo(() => {
    return [...rows].sort((a, b) =>
      (a.nombre ?? "").localeCompare(b.nombre ?? "")
    );
  }, [rows]);

  return (
    <div className="rounded-2xl border bg-white p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">ABM de Rubros</h2>
          <p className="text-sm text-slate-600">Crear, renombrar y eliminar rubros.</p>
        </div>

        <button
          type="button"
          onClick={fetchRubros}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          disabled={loading || creating || !!mutatingId}
        >
          Refrescar
        </button>
      </div>

      <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
        <div className="text-xs font-semibold text-slate-600">Nuevo rubro</div>

        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Ej: Turismo"
            className="w-full rounded-xl border px-3 py-2 text-sm text-slate-900"
          />

          <button
            type="button"
            onClick={createRubro}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-white disabled:opacity-50"
            disabled={creating || loading}
          >
            {creating ? "Creando…" : "Crear"}
          </button>
        </div>

        <div className="mt-2 text-xs text-slate-500">
          Tip: si un rubro está siendo usado por empresas, el DELETE puede fallar por FK (depende tu DB).
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-[1fr_220px] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
          <div>Nombre</div>
          <div className="text-right">Acciones</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
        ) : rubrosOrdenados.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No hay rubros todavía.</div>
        ) : (
          <div className="divide-y">
            {rubrosOrdenados.map((r) => {
              const busy = mutatingId === r.id;

              return (
                <RubroRow
                  key={r.id}
                  rubro={r}
                  busy={busy}
                  onSave={(nombre) => patchRubro(r.id, { nombre })}
                  onDelete={() => deleteRubro(r.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RubroRow({
  rubro,
  busy,
  onSave,
  onDelete,
}: {
  rubro: Rubro;
  busy: boolean;
  onSave: (nombre: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(rubro.nombre ?? "");

  useEffect(() => {
    setNombre(rubro.nombre ?? "");
  }, [rubro.nombre]);

  const canSave =
    nombre.trim().length > 0 && nombre.trim() !== (rubro.nombre ?? "");

  return (
    <div className="grid grid-cols-[1fr_220px] items-center gap-3 px-4 py-3 text-sm">
      <div>
        {editing ? (
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm text-slate-900"
            disabled={busy}
          />
        ) : (
          <div className="font-medium text-slate-900">{rubro.nombre}</div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <>
            <button
              type="button"
              className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={busy || !canSave}
              onClick={() => onSave(nombre.trim())}
            >
              {busy ? "…" : "Guardar"}
            </button>

            <button
              type="button"
              className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setNombre(rubro.nombre ?? "");
                setEditing(false);
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              Editar
            </button>

            <button
              type="button"
              className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                const ok = confirm(`¿Eliminar rubro "${rubro.nombre}"?`);
                if (ok) onDelete();
              }}
            >
              {busy ? "…" : "Eliminar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}