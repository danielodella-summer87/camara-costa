"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { RoleTabs } from "@/components/reports/RoleTabs";

type Lead = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  estado?: string | null;
  notas?: string | null;
  rating?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiResp<T> = { data?: T | null; error?: string | null };

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

function toCSV(rows: Lead[]) {
  const header = [
    "id",
    "nombre",
    "contacto",
    "telefono",
    "email",
    "origen",
    "pipeline",
    "estado",
    "rating",
    "created_at",
    "updated_at",
  ];

  const esc = (v: unknown) => {
    const s = (v ?? "").toString();
    const needs = /[",\n]/.test(s);
    const clean = s.replace(/"/g, '""');
    return needs ? `"${clean}"` : clean;
  };

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.nombre,
        r.contacto,
        r.telefono,
        r.email,
        r.origen,
        r.pipeline,
        r.estado ?? "",
        r.rating ?? "",
        r.created_at ?? "",
        r.updated_at ?? "",
      ]
        .map(esc)
        .join(",")
    ),
  ];

  return lines.join("\n");
}

function ReporteComercialLeadsInner() {
  const sp = useSearchParams();
  // lo dejé por si lo usás más adelante (hoy no afecta)
  const tab = sp.get("tab") || "comercial";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  // filtros
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(""); // yyyy-mm-dd
  const [to, setTo] = useState(""); // yyyy-mm-dd
  const [origen, setOrigen] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [estado, setEstado] = useState("");
  const [minRating, setMinRating] = useState("");

  async function fetchLeads() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResp<Lead[]>;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando leads");

      const rows = Array.isArray(json?.data) ? json.data : [];
      setLeads(rows);
    } catch (e: any) {
      setError(e?.message ?? "Error inesperado");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origenes = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => {
      if (l.origen && l.origen.trim()) s.add(l.origen.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const pipelines = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => {
      if (l.pipeline && l.pipeline.trim()) s.add(l.pipeline.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const estados = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => {
      if (l.estado && l.estado.trim()) s.add(l.estado.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;
    const minR = minRating.trim() ? Number(minRating) : null;

    return leads.filter((l) => {
      // search
      if (needle) {
        const blob = [
          l.nombre,
          l.contacto,
          l.email,
          l.telefono,
          l.origen,
          l.pipeline,
          l.estado,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(needle)) return false;
      }

      // fecha (created_at)
      if (fromTime || toTime) {
        const t = l.created_at ? new Date(l.created_at).getTime() : NaN;
        if (!Number.isFinite(t)) return false;
        if (fromTime && t < fromTime) return false;
        if (toTime && t > toTime) return false;
      }

      if (origen && (l.origen ?? "").trim() !== origen) return false;
      if (pipeline && (l.pipeline ?? "").trim() !== pipeline) return false;
      if (estado && (l.estado ?? "").trim() !== estado) return false;

      if (minR !== null) {
        const r = typeof l.rating === "number" ? l.rating : Number(l.rating);
        if (!Number.isFinite(r)) return false;
        if (r < minR) return false;
      }

      return true;
    });
  }, [leads, q, from, to, origen, pipeline, estado, minRating]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const calientes = filtered.filter((l) => (l.rating ?? 0) >= 4).length;
    const sinOrigen = filtered.filter((l) => !(l.origen && l.origen.trim())).length;
    const sinPipeline = filtered.filter((l) => !(l.pipeline && l.pipeline.trim())).length;
    return { total, calientes, sinOrigen, sinPipeline };
  }, [filtered]);

  const onExport = () => {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_comercial_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQ("");
    setFrom("");
    setTo("");
    setOrigen("");
    setPipeline("");
    setEstado("");
    setMinRating("");
  };

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl border bg-amber-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-900">
                Reportes · Comercial · Leads
              </h1>
              <p className="mt-1 text-sm text-slate-700">
                Listado filtrable + export CSV. (Datos reales desde{" "}
                <span className="font-semibold">/api/admin/leads</span>)
              </p>

              <div className="mt-4">
                <RoleTabs basePath="/admin/reportes" defaultTab="comercial" />
              </div>

              <div className="mt-4 inline-flex overflow-hidden rounded-xl border bg-white">
                <Link
                  href="/admin?tab=comercial"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/reportes?tab=comercial"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  Reportes (catálogo)
                </Link>
                <span className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-900">
                  Leads
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchLeads}
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Cargando…" : "Refrescar"}
              </button>

              <button
                type="button"
                onClick={onExport}
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={loading || filtered.length === 0}
                title="Exportar resultado filtrado"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Leads (filtrados)</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{kpis.total}</div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Calientes (rating ≥ 4)</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{kpis.calientes}</div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Sin origen</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{kpis.sinOrigen}</div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Sin pipeline</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{kpis.sinPipeline}</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <div className="text-xs text-slate-500">Buscar</div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="nombre, contacto, email, origen…"
                />
              </div>

              <div>
                <div className="text-xs text-slate-500">Desde</div>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <div className="text-xs text-slate-500">Hasta</div>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <div className="text-xs text-slate-500">Origen</div>
                <select
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {origenes.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-slate-500">Pipeline</div>
                <select
                  value={pipeline}
                  onChange={(e) => setPipeline(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {pipelines.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-slate-500">Estado</div>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {estados.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-slate-500">Rating mínimo</div>
                <input
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Ej: 4"
                  inputMode="numeric"
                />
              </div>

              <div className="md:col-span-2 flex items-end gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
            <div className="grid grid-cols-12 gap-0 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <div className="col-span-3">Lead</div>
              <div className="col-span-2">Contacto</div>
              <div className="col-span-2">Origen</div>
              <div className="col-span-2">Pipeline</div>
              <div className="col-span-1">Rating</div>
              <div className="col-span-2">Creado</div>
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
            Próximo: agregamos “Aging” (días desde último update), y filtros avanzados (rubro/país)
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