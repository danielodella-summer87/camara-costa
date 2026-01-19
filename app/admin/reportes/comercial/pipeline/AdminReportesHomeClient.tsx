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

export default function AdminReportesHomeClient() {
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
        desc: "Operación del portal (cuando existan registros).",
        disabled: true,
        tag: "próximo",
      },
    ],
  };

  const cards = byTab[tab] ?? byTab.resumen;

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-900">Reportes</h1>
              <p className="mt-1 text-sm text-slate-600">
                Catálogo por rol. Elegí un área y abrí el reporte.
              </p>

              <div className="mt-4">
                <RoleTabs basePath="/admin/reportes" defaultTab="resumen" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
            <Link
  href="/admin"
  className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
>
  Volver a Dashboard
</Link>
                Volver a Dashboard
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {cards.map((r) => (
              <Card key={`${r.title}-${r.href ?? "x"}`} r={r} />
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}