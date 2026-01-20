"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";

type Lead = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  estado?: string | null;
  notas: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  rating?: number | null;
};

type LeadsApiResponse = { data: Lead[] | null; error: string | null };

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-UY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function csvEscape(s: unknown) {
  const str = String(s ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function isoFromDateInput(dateYYYYMMDD: string, endOfDay = false) {
  // "YYYY-MM-DD" -> ISO (inicio o fin de día)
  const t = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  return new Date(dateYYYYMMDD + t).toISOString();
}

function ReporteComercialLeadsInner() {
  const sp = useSearchParams();
  // lo dejé por si lo usás más adelante (hoy no afecta)
  const tab = sp.get("tab") || "comercial";

  // filtros (querystring)
  const q = sp.get("q") ?? "";
  const origen = sp.get("origen") ?? "";
  const pipeline = sp.get("pipeline") ?? "";
  const estado = sp.get("estado") ?? "";
  const ratingMin = sp.get("ratingMin") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  // estado UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  async function fetchLeads() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads", { cache: "no-store" });
      const json = (await res.json()) as LeadsApiResponse;
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (json.error) throw new Error(json.error);
      setLeads(json.data ?? []);
    } catch (e: any) {
      setLeads([]);
      setError(e?.message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(
        new Set(arr.map((x) => (x ?? "").trim()).filter((x) => x.length > 0))
      ).sort((a, b) => a.localeCompare(b));

    return {
      origenes: uniq(leads.map((l) => l.origen)),
      pipelines: uniq(leads.map((l) => l.pipeline)),
      estados: uniq(leads.map((l) => l.estado ?? "")),
    };
  }, [leads]);

  const filtered = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    const ratingN = ratingMin ? Number(ratingMin) : null;

    const fromISO = from ? isoFromDateInput(from, false) : null;
    const toISO = to ? isoFromDateInput(to, true) : null;

    return leads.filter((l) => {
      // búsqueda libre
      if (qNorm) {
        const hay = [
          l.nombre,
          l.contacto,
          l.email,
          l.telefono,
          l.origen,
          l.pipeline,
          l.estado,
          l.notas,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!hay.includes(qNorm)) return false;
      }

      if (origen && (l.origen ?? "") !== origen) return false;
      if (pipeline && (l.pipeline ?? "") !== pipeline) return false;
      if (estado && ((l.estado ?? "") || "") !== estado) return false;

      if (ratingN !== null) {
        const r = typeof l.rating === "number" ? l.rating : null;
        if (r === null) return false;
        if (r < ratingN) return false;
      }

      // fechas (created_at)
      if (fromISO || toISO) {
        if (!l.created_at) return false;
        const c = new Date(l.created_at).toISOString();
        if (fromISO && c < fromISO) return false;
        if (toISO && c > toISO) return false;
      }

      return true;
    });
  }, [leads, q, origen, pipeline, estado, ratingMin, from, to]);

  function exportCSV() {
    const rows = filtered.map((l) => ({
      id: l.id,
      nombre: l.nombre ?? "",
      contacto: l.contacto ?? "",
      telefono: l.telefono ?? "",
      email: l.email ?? "",
      origen: l.origen ?? "",
      pipeline: l.pipeline ?? "",
      estado: l.estado ?? "",
      rating: l.rating ?? "",
      created_at: l.created_at ?? "",
      updated_at: l.updated_at ?? "",
      notas: l.notas ?? "",
    }));

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`reporte-leads-comercial-${stamp}.csv`, rows);
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl border bg-amber-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-900">
                Reporte · Comercial · Leads
              </h1>
              <p className="mt-1 text-sm text-slate-700">
                Listado filtrable + export CSV. (Datos reales desde{" "}
                <span className="font-semibold">/api/admin/leads</span>)
              </p>

              <div className="mt-3 inline-flex overflow-hidden rounded-xl border bg-white">
                <Link
                  href="/admin/reportes?tab=comercial"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  ← Volver a Reportes
                </Link>
                <Link
                  href="/admin?tab=comercial"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  Dashboard (Comercial)
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchLeads}
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Refrescar
              </button>
              <button
                type="button"
                onClick={exportCSV}
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
                disabled={loading || filtered.length === 0}
                title={filtered.length === 0 ? "No hay filas para exportar" : "Exportar"}
              >
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="mt-6 rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Filtros</div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <div className="text-xs font-semibold text-slate-500">Buscar</div>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="nombre, email, teléfono, notas…"
                  value={q}
                  readOnly
                  title="Filtro de búsqueda (próximamente)"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500">Origen</div>
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={origen}
                  disabled
                  title="Filtro de origen (próximamente)"
                >
                  <option value="">Todos</option>
                  {options.origenes.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500">Pipeline</div>
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={pipeline}
                  disabled
                  title="Filtro de pipeline (próximamente)"
                >
                  <option value="">Todos</option>
                  {options.pipelines.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500">Estado</div>
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={estado}
                  disabled
                  title="Filtro de estado (próximamente)"
                >
                  <option value="">Todos</option>
                  {options.estados.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500">Rating ≥</div>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="4"
                  value={ratingMin}
                  readOnly
                  title="Filtro de rating (próximamente)"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <div className="text-xs font-semibold text-slate-500">Desde</div>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={from}
                  readOnly
                  title="Filtro de fecha desde (próximamente)"
                />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs font-semibold text-slate-500">Hasta</div>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={to}
                  readOnly
                  title="Filtro de fecha hasta (próximamente)"
                />
              </div>

              <div className="md:col-span-2 flex items-end gap-2">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-xl border bg-white px-4 py-2 text-sm opacity-50"
                  title="Limpiar filtros (próximamente)"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-600">
              Filas: <span className="font-semibold">{filtered.length}</span> /{" "}
              {leads.length}
            </div>

            {loading ? (
              <div className="p-4 text-sm text-slate-600">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">
                No hay resultados con esos filtros.
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((l) => (
                  <div key={l.id} className="grid grid-cols-12 items-center px-3 py-2 text-sm">
                    <div className="col-span-3 min-w-0">
                      <div className="truncate font-medium text-slate-900">{l.nombre ?? "—"}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{l.email ?? "—"}</div>
                    </div>

                    <div className="col-span-2 min-w-0">
                      <div className="truncate text-slate-800">{l.contacto ?? "—"}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{l.telefono ?? "—"}</div>
                    </div>

                    <div className="col-span-2 truncate text-slate-700">{l.origen ?? "—"}</div>
                    <div className="col-span-2 truncate text-slate-700">{l.pipeline ?? "—"}</div>
                    <div className="col-span-1 text-slate-700">{l.rating ?? "—"}</div>
                    <div className="col-span-2 text-slate-700">{fmtDate(l.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 text-xs text-slate-600">
            Próximo: agregamos "Aging" (días desde último update), y filtros avanzados (rubro/país)
            cuando existan.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Cargando…</div>}>
      <ReporteComercialLeadsInner />
    </Suspense>
  );
}
