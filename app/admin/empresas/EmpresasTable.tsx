"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Empresa = {
  id: string;
  nombre: string;
  rubro: string | null;
  rubro_id?: string | null;
  estado: string | null;
  aprobada: boolean | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
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

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function badgeClasses(kind: "ok" | "warn" | "bad" | "muted") {
  switch (kind) {
    case "ok":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "bad":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function aprobacionLabel(e: Empresa) {
  if (e.aprobada) return "Aprobada";
  if (e.estado?.toLowerCase() === "rechazada") return "Rechazada";
  return "Pendiente";
}

function aprobacionKind(e: Empresa): "ok" | "warn" | "bad" | "muted" {
  if (e.aprobada) return "ok";
  if (e.estado?.toLowerCase() === "rechazada") return "bad";
  return "warn";
}

export default function EmpresasTable() {
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Empresa[]>([]);

  // UX: búsqueda + filtro estado
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"all" | "pendiente" | "aprobada" | "rechazada">("all");

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

      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando empresas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function patchEmpresa(
    id: string,
    payload: Partial<Pick<Empresa, "aprobada" | "estado">>
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

      // Refresco para consistencia
      await fetchEmpresas();
    } catch (e: any) {
      setError(e?.message ?? "Error actualizando empresa");
    } finally {
      setMutatingId(null);
    }
  }

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const visible = useMemo(() => {
    const nq = normalize(q);

    return [...rows]
      .filter((e) => {
        // filtro estado
        if (estado === "aprobada") return e.aprobada === true;
        if (estado === "rechazada") return e.estado?.toLowerCase() === "rechazada";
        if (estado === "pendiente")
          return !e.aprobada && e.estado?.toLowerCase() !== "rechazada";
        return true;
      })
      .filter((e) => {
        if (!nq) return true;
        const hay =
          normalize(e.nombre ?? "").includes(nq) ||
          normalize(e.rubro ?? "").includes(nq) ||
          normalize(e.estado ?? "").includes(nq) ||
          normalize(e.telefono ?? "").includes(nq);
        return hay;
      })
      .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
  }, [rows, q, estado]);

  return (
    <div className="rounded-2xl border bg-white p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Listado</h2>
          <p className="text-sm text-slate-600">
            Directorio de empresas. Podés <span className="font-medium">ver</span>,{" "}
            <span className="font-medium">aprobar</span> o{" "}
            <span className="font-medium">rechazar</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
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

      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-sm">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, rubro, estado o teléfono…"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-slate-600">Estado</div>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as any)}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-[1.2fr_0.9fr_0.7fr_0.7fr_260px] bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
          <div>Empresa</div>
          <div>Rubro</div>
          <div>Estado</div>
          <div>Aprobación</div>
          <div className="text-right">Acción</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            No hay resultados para tu búsqueda/filtro.
          </div>
        ) : (
          <div className="divide-y">
            {visible.map((e) => {
              const busy = mutatingId === e.id;

              return (
                <div
                  key={e.id}
                  className="grid grid-cols-[1.2fr_0.9fr_0.7fr_0.7fr_260px] items-center px-4 py-3 text-sm"
                >
                  <div className="font-medium text-slate-900">{e.nombre}</div>

                  <div className="text-slate-700">{e.rubro ?? "—"}</div>

                  <div className="text-slate-700">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                        badgeClasses(
                          e.estado?.toLowerCase() === "rechazada"
                            ? "bad"
                            : e.aprobada
                            ? "ok"
                            : "muted"
                        ),
                      ].join(" ")}
                    >
                      {e.estado ?? "—"}
                    </span>
                  </div>

                  <div className="text-slate-700">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                        badgeClasses(aprobacionKind(e)),
                      ].join(" ")}
                    >
                      {aprobacionLabel(e)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => patchEmpresa(e.id, { aprobada: true, estado: "Aprobada" })}
                      className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={busy || loading || e.aprobada === true}
                      title={e.aprobada ? "Ya está aprobada" : "Aprobar empresa"}
                    >
                      {busy ? "…" : "Aprobar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => patchEmpresa(e.id, { aprobada: false, estado: "Rechazada" })}
                      className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                      disabled={busy || loading || e.estado?.toLowerCase() === "rechazada"}
                      title={
                        e.estado?.toLowerCase() === "rechazada"
                          ? "Ya está rechazada"
                          : "Rechazar empresa"
                      }
                    >
                      {busy ? "…" : "Rechazar"}
                    </button>

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

      <div className="mt-3 text-xs text-slate-500">
        Tip: usá <span className="font-semibold">Ver</span> para entrar al detalle y editar campos como
        descripción, dirección, web e instagram.
      </div>
    </div>
  );
}