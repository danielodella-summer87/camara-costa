"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { RoleTabs } from "@/components/reports/RoleTabs";

type TabKey =
  | "resumen"
  | "direccion"
  | "comercial"
  | "marketing"
  | "administracion"
  | "tecnico";

type ReportCard = {
  title: string;
  desc: string;
  href?: string;
  disabled?: boolean;
  tag?: string;
};

function SectionBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-600">
      {text}
    </span>
  );
}

function Card({ r }: { r: ReportCard }) {
  const inner = (
    <div
      className={[
        "rounded-2xl border bg-white p-4 transition",
        r.disabled ? "opacity-60" : "hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-900">{r.title}</div>
          <div className="mt-1 text-sm text-slate-600">{r.desc}</div>
        </div>
        {r.tag ? <SectionBadge text={r.tag} /> : null}
      </div>
      <div className="mt-3 text-xs text-slate-500">
        {r.disabled ? "Próximamente" : "Abrir reporte"}
      </div>
    </div>
  );

  if (r.disabled || !r.href) return inner;

  return (
    <Link href={r.href} className="block">
      {inner}
    </Link>
  );
}

export default function AdminReportesHome() {
  const sp = useSearchParams();
  const tab = (sp.get("tab") as TabKey | null) ?? "resumen";

  const byTab: Record<TabKey, ReportCard[]> = {
    resumen: [
      {
        title: "Vista general (demo)",
        desc: "Entrada rápida: elegí un rol para ver reportes disponibles.",
        disabled: true,
        tag: "demo",
      },
    ],
    direccion: [
      {
        title: "Ingresos / Socios / Renovaciones (demo)",
        desc: "KPIs y listados ejecutivos (cuando tengamos datos reales).",
        disabled: true,
        tag: "próximo",
      },
    ],
    comercial: [
      {
        title: "Leads (listado + filtros)",
        desc: "Filtrá por fecha, origen, pipeline, estado, rating y exportá a CSV.",
        href: "/admin/reportes/comercial/leads?tab=comercial",
      },
      {
        title: "Pipeline + Aging (stale 30 días)",
        desc: "Tabla por pipeline + Top stale + export. Riesgo = rating ≤ 2 + sin actualización.",
        href: "/admin/reportes/comercial/pipeline?tab=comercial",
        tag: "nuevo",
      },
      {
        title: "Propuestas (historial) (demo)",
        desc: "Listado de PDFs por lead, fechas, estado, export.",
        disabled: true,
        tag: "próximo",
      },
    ],
    marketing: [
      {
        title: "Origen / Campañas / Conversión (demo)",
        desc: "Rendimiento por canal y atribución.",
        disabled: true,
        tag: "próximo",
      },
    ],
    administracion: [
      {
        title: "Pagos / Mora / Renovaciones (demo)",
        desc: "Control administrativo (cuando existan tablas).",
        disabled: true,
        tag: "próximo",
      },
    ],
    tecnico: [
      {
        title: "Tickets / Estado portal / Incidentes (demo)",
        desc: "Salud técnica y backlog.",
        disabled: true,
        tag: "próximo",
      },
    ],
  };

  const cards = byTab[tab] ?? [];

  const bgByTab: Record<TabKey, string> = {
    resumen: "bg-sky-50 border-sky-100",
    direccion: "bg-indigo-50 border-indigo-100",
    comercial: "bg-amber-50 border-amber-100",
    marketing: "bg-pink-50 border-pink-100",
    administracion: "bg-emerald-50 border-emerald-100",
    tecnico: "bg-violet-50 border-violet-100",
  };

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className={`rounded-2xl border p-6 ${bgByTab[tab]}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-900">Reportes</h1>
              <p className="mt-1 text-sm text-slate-700">
                Catálogo de reportes (listados con filtros + export). Elegí un rol.
              </p>

              <div className="mt-4">
                <RoleTabs basePath="/admin/reportes" defaultTab="resumen" />
              </div>

              <div className="mt-4 inline-flex overflow-hidden rounded-xl border bg-white">
                <Link
                  href="/admin?tab=resumen"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  Dashboard
                </Link>
                <span className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-900">
                  Reportes
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/leads"
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Ir a Leads
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {cards.map((r) => (
              <Card key={r.title} r={r} />
            ))}
          </div>

          <div className="mt-4 text-xs text-slate-600">
            Concepto: <span className="font-semibold">Dashboard</span> = KPIs/alertas rápidas.
            <span className="mx-2">·</span>
            <span className="font-semibold">Reportes</span> = listados con filtros + export.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}