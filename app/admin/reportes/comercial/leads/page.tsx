"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function toISODateOnly(v: string) {
  // input: "YYYY-MM-DD" -> ISO start of that day local-ish
  // para demo: suficiente
  return new Date(v + "T00:00:00").toISOString();
}

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

export default function ReporteComercialLeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

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
      if (json.error) throw new Error(json.error);
      setLeads(json.data ?? concludeEmpty(json.data));
    } catch (e: any) {
      setLeads([]);
      setError(e?.message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function concludeEmpty(v: unknown) {
    return [] as Lead[];
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

    const fromISO = from ? toISODateOnly(from) : null;
    const toISO = to ? toISODateOnly(to) : null;

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

  function setParam(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    // aseguramos tab=comercial para mantener el contexto
    params.set("tab", "comercial");

    Object.entries(next).forEach(([k, v]) => {
      if (!v) rememberDelete(params, k);
      else params.set(k, v);
    });

    router.push(`${pathname}?${params.toString()}`);
  }

  function rememberDelete(params: URLSearchParams, k: string) {
    params.delete(k);
  }

  function clearFilters() {
    router.push(`${pathname}?tab=comercial`);
  }

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
                Listado con filtros + export a CSV (por ahora filtra en pantalla,
                luego lo bajamos a API cuando sumemos datos).
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
                title={
                  filtered.length === 0 ? "No hay filas para exportar" : "Exportar"
                }
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
                  onChange={(e) => setParam({ q: e.target.value })}
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500">Origen</div>
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={origen}
                  onChange={(e) => setParam({ origen: e.target.value })}
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
                  onChange={(e) => setParam({ pipeline: e.target.value })}
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
                  onChange={(e) => setParam({ estado: e.target.value })}
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
                  onChange={(e) =>
                    setParam({ ratingMin: e.target.value.replace(/[^\d.]/g, "") })
                  }
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
                  onChange={(e) => setParam({ from: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs font-semibold text-slate-500">Hasta</div>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={to}
                  onChange={(e) => setParam({ to: e.target.value })}
                />
              </div>

              <div className="md:col-span-2 flex items-end gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-600">
              Filas:{" "}
              <span className="font-semibold">{filtered.length}</span> / {leads.length}
            </div>
          </div>

          {/* Tabla */}
          <div className="mt-6 rounded-2xl border bg-white">
            <div className="overflow-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Origen</th>
                    <th className="px-4 py-3">Pipeline</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-600" colSpan={8}>
                        Cargando…
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td className="px-4 py-4 text-red-700" colSpan={8}>
                        Error: {error}
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-600" colSpan={8}>
                        Sin resultados con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((l) => (
                      <tr key={l.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/leads/${l.id}`}
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            {l.nombre ?? "—"}
                          </Link>
                          <div className="text-xs text-slate-500">
                            {l.contacto ?? ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">{l.email ?? "—"}</td>
                        <td className="px-4 py-3">{l.telefono ?? "—"}</td>
                        <td className="px-4 py-3">{l.origen ?? "—"}</td>
                        <td className="px-4 py-3">{l.pipeline ?? "—"}</td>
                        <td className="px-4 py-3">{l.estado ?? "—"}</td>
                        <td className="px-4 py-3">
                          {typeof l.rating === "number" ? l.rating : "—"}
                        </td>
                        <td className="px-4 py-3">{fmtDate(l.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-600">
            Definición que estamos usando: <span className="font-semibold">Dashboard</span> = KPIs/alertas.
            <span className="mx-2">·</span>
            <span className="font-semibold">Reportes</span> = listados con filtros + export.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}