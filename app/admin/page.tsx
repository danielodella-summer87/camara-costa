"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

type Lead = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  estado?: string | null;
};

type PipelineRow = {
  id: string;
  nombre: string;
  posicion: number;
  color: string | null;
  created_at?: string;
  updated_at?: string;
};

type ApiResp<T> = {
  data?: T | null;
  error?: string | null;
};

function norm(v: string | null | undefined) {
  return (v ?? "").trim();
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);

  async function fetchDashboard() {
    setError(null);
    setLoading(true);

    try {
      const [lRes, pRes] = await Promise.all([
        fetch("/api/admin/leads", {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        }),
        fetch("/api/admin/leads/pipelines", {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        }),
      ]);

      const lJson = (await lRes.json()) as ApiResp<Lead[]>;
      const pJson = (await pRes.json()) as ApiResp<PipelineRow[]>;

      if (!lRes.ok) throw new Error(lJson?.error ?? "Error cargando leads");
      if (!pRes.ok) throw new Error(pJson?.error ?? "Error cargando pipelines");

      const lData = Array.isArray(lJson?.data) ? lJson.data : [];
      const pData = Array.isArray(pJson?.data) ? pJson.data : [];

      pData.sort((a, b) => (a.posicion ?? 0) - (b.posicion ?? 0));
      // leads: más nuevos primero (created_at desc)
      lData.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") * -1);

      setLeads(lData);
      setPipelines(pData);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando dashboard");
      setLeads([]);
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  const kpis = useMemo(() => {
    const total = leads.length;

    const byPipeline = new Map<string, number>();
    let sinPipeline = 0;

    for (const l of leads) {
      const p = norm(l.pipeline);
      if (!p) {
        sinPipeline += 1;
      } else {
        byPipeline.set(p, (byPipeline.get(p) ?? 0) + 1);
      }
    }

    const orderedPipelines = pipelines.map((p) => p.nombre);
    const countsOrdered = orderedPipelines.map((name) => ({
      nombre: name,
      count: byPipeline.get(name) ?? 0,
      color: pipelines.find((x) => x.nombre === name)?.color ?? null,
    }));

    // también mostramos pipelines “sueltos” que existan en leads pero no en tabla
    const extra: { nombre: string; count: number; color: string | null }[] = [];
    for (const [name, count] of byPipeline.entries()) {
      if (!orderedPipelines.includes(name)) extra.push({ nombre: name, count, color: null });
    }
    extra.sort((a, b) => b.count - a.count);

    const lastUpdated =
      leads
        .map((l) => l.updated_at ?? l.created_at ?? null)
        .filter(Boolean)
        .sort()
        .reverse()[0] ?? null;

    return {
      total,
      sinPipeline,
      pipelinesTotal: pipelines.length,
      countsOrdered,
      extra,
      lastUpdated,
    };
  }, [leads, pipelines]);

  const lastLeads = useMemo(() => leads.slice(0, 8), [leads]);

  return (
    <PageContainer>
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-600">
              KPIs rápidos + accesos. (Esto reemplaza el /admin que hoy te mostraba Leads)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/leads" className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">
              Leads (lista)
            </Link>
            <Link href="/admin/leads/kanban" className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">
              Leads (kanban)
            </Link>
            <Link href="/admin/leads/importar" className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">
              Importar
            </Link>
            <button
              type="button"
              onClick={fetchDashboard}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              disabled={loading}
            >
              Refrescar
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* KPIs */}
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border p-4">
            <div className="text-xs font-semibold text-slate-600">Leads totales</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {loading ? "…" : kpis.total}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs font-semibold text-slate-600">Pipelines configurados</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {loading ? "…" : kpis.pipelinesTotal}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs font-semibold text-slate-600">Sin pipeline</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {loading ? "…" : kpis.sinPipeline}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs font-semibold text-slate-600">Última actualización</div>
            <div className="mt-2 text-sm font-medium text-slate-900">
              {loading ? "…" : fmtDate(kpis.lastUpdated)}
            </div>
          </div>
        </div>

        {/* Conteo por pipeline */}
        <div className="mt-6 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Distribución por pipeline</div>
              <div className="mt-1 text-xs text-slate-500">Basado en leads actuales + tabla leads_pipelines.</div>
            </div>
            <Link href="/admin/leads/kanban" className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50">
              Ver en Kanban
            </Link>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {loading ? (
              <div className="text-sm text-slate-500">Cargando…</div>
            ) : (
              <>
                {kpis.countsOrdered.map((p) => (
                  <div key={p.nombre} className="rounded-xl border bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: (p.color ?? "").trim() || "#e2e8f0" }}
                        />
                        <div className="text-sm font-medium text-slate-900">{p.nombre}</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{p.count}</div>
                    </div>
                  </div>
                ))}

                {kpis.extra.length > 0 && (
                  <div className="rounded-xl border bg-amber-50 px-3 py-2 md:col-span-3">
                    <div className="text-xs font-semibold text-amber-900">
                      Pipelines presentes en leads pero no en tabla
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {kpis.extra.slice(0, 10).map((x) => (
                        <span key={x.nombre} className="rounded-full border bg-white px-2 py-1 text-xs text-slate-700">
                          {x.nombre}: <span className="font-semibold">{x.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Últimos leads */}
        <div className="mt-6 overflow-hidden rounded-2xl border">
          <div className="bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            Últimos leads
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-500">Cargando…</div>
          ) : lastLeads.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">No hay leads.</div>
          ) : (
            <div className="divide-y">
              {lastLeads.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{l.nombre ?? "—"}</div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full border bg-white px-2 py-0.5">{l.pipeline ?? "Sin pipeline"}</span>
                      <span className="rounded-full border bg-white px-2 py-0.5">{l.origen ?? "—"}</span>
                      <span className="rounded-full border bg-white px-2 py-0.5">{fmtDate(l.created_at)}</span>
                    </div>
                  </div>

                  <Link
                    href={`/admin/leads/${l.id}`}
                    className="shrink-0 rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Ver
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Nota: ahora <span className="font-semibold">/admin</span> es Dashboard real; el listado quedó en{" "}
          <span className="font-semibold">/admin/leads</span>.
        </div>
      </div>
    </PageContainer>
  );
}