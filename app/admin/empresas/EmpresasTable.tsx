"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import RubroSelect from "./RubroSelect";

type Empresa = {
  id: string;
  nombre: string;
  rubro: string | null; // display (nombre)
  rubro_id: string | null; // UUID real
  estado: string | null;
  aprobada: boolean | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  instagram?: string | null;
  direccion?: string | null;
  descripcion?: string | null;
  created_at?: string;
  updated_at?: string;
};

type EmpresasApiResponse = {
  data?: Empresa[];
  error?: string | null;
};

type EmpresaApiResponse = {
  data?: Empresa | null;
  error?: string | null;
};

type Rubro = { id: string; nombre: string };
type RubrosApiResponse = { data?: Rubro[]; error?: string | null };

export default function EmpresasTable() {
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rows, setRows] = useState<Empresa[]>([]);

  // filtros UI
  const [q, setQ] = useState("");

  // edición inline rubro
  const [editingRubroForId, setEditingRubroForId] = useState<string | null>(null);
  const [pendingRubroId, setPendingRubroId] = useState<string | null>(null);

  // cache en memoria: nombre -> id (solo para legacy donde viene rubro pero no rubro_id)
  const rubroNombreToIdRef = useRef<Map<string, string> | null>(null);
  const rubroMapLoadingRef = useRef<Promise<Map<string, string>> | null>(null);

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function ensureRubroNombreToIdMap(): Promise<Map<string, string>> {
    if (rubroNombreToIdRef.current) return rubroNombreToIdRef.current;
    if (rubroMapLoadingRef.current) return rubroMapLoadingRef.current;

    rubroMapLoadingRef.current = (async () => {
      const res = await fetch("/api/admin/rubros", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as RubrosApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando rubros");

      const map = new Map<string, string>();
      (json?.data ?? []).forEach((r) => map.set(r.nombre, r.id));

      rubroNombreToIdRef.current = map;
      rubroMapLoadingRef.current = null;
      return map;
    })();

    return rubroMapLoadingRef.current;
  }

  async function fetchEmpresas() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/empresas", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as EmpresasApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando empresas");

      const list = Array.isArray(json?.data) ? json.data : [];
      setRows(
        list.map((e: any) => ({
          ...e,
          rubro_id: e?.rubro_id ?? null,
        }))
      );
    } catch (e: any) {
      setError(e?.message ?? "Error cargando empresas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // PATCH que devuelve la empresa actualizada y actualiza SOLO la fila local
  async function patchEmpresa(
    id: string,
    payload: Partial<Pick<Empresa, "rubro_id" | "aprobada" | "estado">>
  ) {
    setError(null);
    setMutatingId(id);

    try {
      const res = await fetch(`/api/admin/empresas/${id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as EmpresaApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error actualizando empresa");

      const updated = json?.data ?? null;
      if (!updated) throw new Error("No se recibió la empresa actualizada");

      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, ...updated, rubro_id: (updated as any).rubro_id ?? null }
            : r
        )
      );

      return updated;
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando empresa");
      throw e;
    } finally {
      setMutatingId(null);
    }
  }

  useEffect(() => {
    fetchEmpresas();
  }, []);

  function aprobacionLabel(e: Empresa) {
    if (e.aprobada) return "Aprobada";
    if ((e.estado ?? "").toLowerCase() === "rechazada") return "Rechazada";
    return "Pendiente";
  }

  function badgeClassEstado(v: string) {
    const s = v.toLowerCase();
    if (s === "aprobada") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (s === "rechazada") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  function badgeClassAprobacion(v: string) {
    const s = v.toLowerCase();
    if (s === "aprobada") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (s === "rechazada") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  const empresasFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = [...rows];

    if (term.length) {
      list = list.filter((e) => {
        const haystack = [e.nombre ?? "", e.rubro ?? "", e.telefono ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    list.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
    return list;
  }, [rows, q]);

  async function startEditRubro(e: Empresa) {
    setError(null);
    setEditingRubroForId(e.id);

    if (e.rubro_id) {
      setPendingRubroId(e.rubro_id);
      return;
    }

    if (e.rubro) {
      setPendingRubroId(null);
      try {
        const map = await ensureRubroNombreToIdMap();
        const resolved = map.get(e.rubro);
        setPendingRubroId(resolved ?? null);
      } catch (err: any) {
        setError(err?.message ?? "No pude cargar rubros para resolver rubro_id.");
      }
      return;
    }

    setPendingRubroId(null);
  }

  function cancelEditRubro() {
    setEditingRubroForId(null);
    setPendingRubroId(null);
  }

  async function saveEditRubro(e: Empresa) {
    if (!pendingRubroId) {
      setError("Elegí un rubro antes de guardar.");
      return;
    }

    const prevRubroId = e.rubro_id;
    const prevRubro = e.rubro;

    // Optimistic UI: reflejamos rubro_id (el nombre lo completa el backend)
    setRows((prev) =>
      prev.map((r) =>
        r.id === e.id ? { ...r, rubro_id: pendingRubroId } : r
      )
    );

    try {
      const updated = await patchEmpresa(e.id, { rubro_id: pendingRubroId });
      flash(`Rubro guardado: ${updated.rubro ?? "OK"}`);
      setEditingRubroForId(null);
      setPendingRubroId(null);
    } catch {
      // revert
      setRows((prev) =>
        prev.map((r) =>
          r.id === e.id
            ? { ...r, rubro_id: prevRubroId ?? null, rubro: prevRubro ?? null }
            : r
        )
      );
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Listado</h2>
          <p className="text-sm text-slate-600">
            Directorio de empresas. Podés ver, aprobar o rechazar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/empresas/nueva"
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
          >
            Nueva empresa
          </Link>

          <button
            type="button"
            onClick={fetchEmpresas}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={loading || !!mutatingId}
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
          placeholder="Buscar por nombre, rubro o teléfono..."
          className="w-full rounded-xl border px-4 py-2 text-sm md:max-w-xl"
        />
      </div>

      {/* tabla */}
      <div className="mt-5 overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-[1.2fr_1.1fr_200px] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
          <div>Empresa</div>
          <div>Rubro</div>
          <div className="text-right">Acción</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
        ) : empresasFiltradas.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            No hay empresas para mostrar con esos filtros.
          </div>
        ) : (
          <div className="divide-y">
            {empresasFiltradas.map((e) => {
              const busy = mutatingId === e.id;
              const isEditingRubro = editingRubroForId === e.id;

              return (
                <div
                  key={e.id}
                  className="grid grid-cols-[1.2fr_1.1fr_200px] items-center px-4 py-3 text-sm"
                >
                  {/* Empresa */}
                  <div className="font-medium text-slate-900">{e.nombre}</div>

                  {/* Rubro */}
                  <div className="text-slate-700">
                    {!isEditingRubro ? (
                      <div className="flex items-center gap-2">
                        <span>{e.rubro ?? "—"}</span>
                        <button
                          type="button"
                          onClick={() => startEditRubro(e)}
                          className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                          disabled={busy || loading}
                          title="Cambiar rubro"
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="min-w-[220px]">
                          <RubroSelect
                            value={pendingRubroId}
                            onChange={(next) => setPendingRubroId(next)}
                            disabled={busy || loading}
                            placeholder="Seleccionar rubro…"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => saveEditRubro(e)}
                          className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                          disabled={
                            busy ||
                            loading ||
                            !pendingRubroId ||
                            pendingRubroId === (e.rubro_id ?? null)
                          }
                          title="Guardar rubro"
                        >
                          Guardar
                        </button>

                        <button
                          type="button"
                          onClick={cancelEditRubro}
                          className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                          disabled={busy || loading}
                          title="Cancelar"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/admin/empresas/${e.id}`}
                      className="inline-flex items-center justify-center rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50"
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

      <div className="mt-4 text-xs text-slate-500">
        Tip: se guarda <span className="font-semibold">rubro_id</span> y el backend completa{" "}
        <span className="font-semibold">rubro</span> (nombre) para mostrar.
      </div>
    </div>
  );
}