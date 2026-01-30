"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type Comercial = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

type ApiResp<T> = { data: T | null; error: string | null };

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Error desconocido";
  }
}

export default function ComercialesTab() {
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<Comercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form nuevo
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [activo, setActivo] = useState(true);

  // edición simple inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [editActivo, setEditActivo] = useState(true);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/comerciales", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResp<Comercial[]>;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando comerciales");

      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setRows([]);
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const rowsSorted = useMemo(() => {
    return [...(rows ?? [])].sort((a, b) => {
      // activos primero, luego nombre
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      return (a.nombre ?? "").localeCompare(b.nombre ?? "");
    });
  }, [rows]);

  function resetForm() {
    setNombre("");
    setEmail("");
    setTelefono("");
    setActivo(true);
  }

  async function onCreate() {
    setError(null);

    const n = nombre.trim();
    if (!n) {
      setError("Nombre es obligatorio");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/comerciales", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
          body: JSON.stringify({
            nombre: n,
            email: email.trim() || null,
            telefono: telefono.trim() || null,
            activo,
          }),
        });

        const json = (await res.json()) as ApiResp<Comercial>;
        if (!res.ok) throw new Error(json?.error ?? "Error creando comercial");

        resetForm();
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
      }
    });
  }

  function beginEdit(r: Comercial) {
    setEditId(r.id);
    setEditNombre(r.nombre ?? "");
    setEditEmail(r.email ?? "");
    setEditTelefono(r.telefono ?? "");
    setEditActivo(!!r.activo);
  }

  function cancelEdit() {
    setEditId(null);
    setEditNombre("");
    setEditEmail("");
    setEditTelefono("");
    setEditActivo(true);
  }

  async function saveEdit() {
    if (!editId) return;

    const n = editNombre.trim();
    if (!n) {
      setError("Nombre es obligatorio");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/comerciales/${editId}`, {
          method: "PATCH",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
          body: JSON.stringify({
            nombre: n,
            email: editEmail.trim() || null,
            telefono: editTelefono.trim() || null,
            activo: editActivo,
          }),
        });

        const json = (await res.json()) as ApiResp<Comercial>;
        if (!res.ok) throw new Error(json?.error ?? "Error actualizando comercial");

        cancelEdit();
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
      }
    });
  }

  async function onDelete(id: string) {
    setError(null);
    const ok = confirm("¿Seguro que querés eliminar este comercial?");
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/comerciales/${id}`, {
          method: "DELETE",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const json = (await res.json()) as ApiResp<{ ok: true }>;
        if (!res.ok) throw new Error(json?.error ?? "Error eliminando comercial");
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Comerciales</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cargá y administrá vendedores para asignarlos a cada lead.
        </p>
      </div>

      {/* Crear */}
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Nuevo comercial</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="text-xs text-slate-600">Nombre *</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Camila"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-slate-600">Email</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ej: comercial@..."
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-slate-600">Teléfono</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="ej: +598..."
            />
          </div>

          <div className="md:col-span-1 flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              Activo
            </label>

            <button
              onClick={onCreate}
              disabled={isPending}
              className="ml-auto rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      {/* Lista */}
      <div className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b p-4">
          <div className="text-sm font-semibold text-slate-900">Listado</div>
          <button
            onClick={refresh}
            disabled={loading || isPending}
            className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
          >
            Recargar
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-slate-600">Cargando…</div>
        ) : rowsSorted.length === 0 ? (
          <div className="p-4 text-sm text-slate-600">No hay comerciales aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Activo</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {rowsSorted.map((r) => {
                  const isEditing = editId === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            className="w-full rounded-lg border px-2 py-1"
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                          />
                        ) : (
                          r.nombre
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            className="w-full rounded-lg border px-2 py-1"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                          />
                        ) : (
                          r.email ?? "—"
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            className="w-full rounded-lg border px-2 py-1"
                            value={editTelefono}
                            onChange={(e) => setEditTelefono(e.target.value)}
                          />
                        ) : (
                          r.telefono ?? "—"
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={editActivo}
                            onChange={(e) => setEditActivo(e.target.checked)}
                          />
                        ) : r.activo ? (
                          "Sí"
                        ) : (
                          "No"
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveEdit}
                                disabled={isPending}
                                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={isPending}
                                className="rounded-xl border px-3 py-2 text-xs disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => beginEdit(r)}
                                disabled={isPending}
                                className="rounded-xl border px-3 py-2 text-xs disabled:opacity-50"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => onDelete(r.id)}
                                disabled={isPending}
                                className="rounded-xl border px-3 py-2 text-xs text-red-700 disabled:opacity-50"
                                title="Eliminar"
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {error && <div className="p-4 text-sm text-red-600">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
