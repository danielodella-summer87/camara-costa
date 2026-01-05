"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";

type Lead = {
  id: string;
  nombre: string | null;
  origen: string | null;
  pipeline: string | null;
  estado?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  rating?: number | null;
  next_activity_type?: string | null;
  next_activity_at?: string | null;
};

type ApiResp<T> = { data?: T | null; error?: string | null };

type TabKey =
  | "resumen"
  | "direccion"
  | "comercial"
  | "marketing"
  | "administracion"
  | "tecnico";

const TABS: { key: TabKey; label: string; tone: string; pageTone: string }[] = [
  {
    key: "resumen",
    label: "Resumen",
    tone: "bg-sky-50 border-sky-200 text-sky-800",
    pageTone: "bg-sky-50/50",
  },
  {
    key: "direccion",
    label: "Dirección",
    tone: "bg-indigo-50 border-indigo-200 text-indigo-800",
    pageTone: "bg-indigo-50/40",
  },
  {
    key: "comercial",
    label: "Comercial",
    tone: "bg-amber-50 border-amber-200 text-amber-800",
    pageTone: "bg-amber-50/40",
  },
  {
    key: "marketing",
    label: "Marketing",
    tone: "bg-pink-50 border-pink-200 text-pink-800",
    pageTone: "bg-pink-50/40",
  },
  {
    key: "administracion",
    label: "Administración",
    tone: "bg-emerald-50 border-emerald-200 text-emerald-800",
    pageTone: "bg-emerald-50/40",
  },
  {
    key: "tecnico",
    label: "Técnico",
    tone: "bg-violet-50 border-violet-200 text-violet-800",
    pageTone: "bg-violet-50/40",
  },
];

function toDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function clampRating(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.trunc(n)));
}

function KPI({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("tab") as TabKey) || "resumen";
  const tabTone = TABS.find((t) => t.key === activeTab)?.pageTone ?? "bg-sky-50/50";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  function setTab(next: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function fetchDashboard() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/leads", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResp<Lead[]>;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando leads");

      const rows = Array.isArray(json?.data) ? json.data : [];
      setLeads(rows);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando datos");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = leads.length;
    const d7 = daysAgo(7);
    const nuevos7 = leads.filter((l) => {
      const d = toDate(l.created_at);
      return d ? d >= d7 : false;
    }).length;

    const avgRating =
      leads.length > 0
        ? Math.round(
            (leads.reduce((acc, l) => acc + clampRating(l.rating ?? 0), 0) / leads.length) * 10
          ) / 10
        : 0;

    const sinUpdate30 = leads.filter((l) => {
      const u = toDate(l.updated_at);
      if (!u) return true;
      return u < daysAgo(30);
    }).length;

    return { total, nuevos7, avgRating, sinUpdate30 };
  }, [leads]);

  return (
    <PageContainer>
      <div className={`rounded-2xl border p-6 ${tabTone}`}>
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Panorama general + accesos rápidos.</p>

              <div className="mt-3 inline-flex overflow-hidden rounded-xl border bg-white">
                <span className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-900">
                  Dashboard
                </span>
                <Link
                  href="/admin/reportes"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  Reportes
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {TABS.map((t) => {
                  const isActive = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={[
                        "rounded-full border px-5 py-2 text-sm transition",
                        t.tone,
                        isActive
                          ? "ring-2 ring-slate-400 font-semibold"
                          : "opacity-80 hover:opacity-100",
                      ].join(" ")}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchDashboard}
                disabled={loading}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? "Cargando…" : "Refrescar"}
              </button>

              <Link
                href="/admin/leads"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
              >
                Ir a Leads
              </Link>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            {activeTab === "resumen" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <KPI label="Leads totales" value={stats.total} />
                <KPI label="Nuevos (7 días)" value={stats.nuevos7} />
                <KPI label="Prom. rating" value={stats.avgRating} />
                <KPI label="Sin update (30 días)" value={stats.sinUpdate30} />
              </div>
            )}

            {activeTab !== "resumen" && (
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  {TABS.find((t) => t.key === activeTab)?.label} (demo)
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Este bloque lo completamos con KPIs específicos de rol. Hoy está como placeholder.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}