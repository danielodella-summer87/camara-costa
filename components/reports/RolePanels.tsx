"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { TabKey } from "./RoleTabs";

type Variant = "dashboard" | "reportes";

const TAB_LABEL: Record<TabKey, string> = {
  resumen: "Resumen",
  direccion: "Dirección",
  comercial: "Comercial",
  marketing: "Marketing",
  administracion: "Administración",
  tecnico: "Técnico",
};

function safeTab(v: string | null): TabKey {
  const k = (v ?? "resumen") as TabKey;
  return TAB_LABEL[k] ? k : "resumen";
}

const TAB_PASTEL_BG: Record<TabKey, string> = {
  resumen: "bg-sky-50 border-sky-100",
  direccion: "bg-indigo-50 border-indigo-100",
  comercial: "bg-amber-50 border-amber-100",
  marketing: "bg-pink-50 border-pink-100",
  administracion: "bg-emerald-50 border-emerald-100",
  tecnico: "bg-violet-50 border-violet-100",
};

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-sm text-slate-500">{sub}</div> : null}
    </div>
  );
}

function Box({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 text-sm text-slate-700">{children}</div>
    </div>
  );
}

function PillLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      {label}
    </Link>
  );
}

function DashboardResumen() {
  // Demo (luego lo conectamos a datos reales)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Socios activos" value="128" sub="demo" />
        <KpiCard label="Ingresos mes" value="$ 245.000" sub="demo" />
        <KpiCard label="Leads calientes" value="14" sub="rating ≥ 4 (demo)" />
        <KpiCard label="Riesgo baja" value="9" sub="sin updates 30d (demo)" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Box title="Alertas rápidas (demo)">
          <ul className="list-disc space-y-2 pl-5">
            <li>9 socios con riesgo de baja (rating alto + 30 días sin actualización)</li>
            <li>3 oportunidades comerciales listas para propuesta</li>
            <li>2 eventos próximos con cupos críticos</li>
          </ul>
        </Box>

        <Box title="Próximas acciones (demo)">
          <ul className="space-y-2">
            <li>📞 Llamar a 5 leads rating 4–5</li>
            <li>🤝 Coordinar 2 reuniones con empresas prospecto</li>
            <li>🗳️ Publicar campaña IG “beneficios de socios”</li>
          </ul>
        </Box>
      </div>

      <Box title="Checklist ejecutivo (demo)">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-slate-50 px-3 py-2">
            ✅ Ventas: foco en leads rating alto
          </div>
          <div className="rounded-xl border bg-slate-50 px-3 py-2">
            ✅ Marketing: campaña beneficios + retención
          </div>
          <div className="rounded-xl border bg-slate-50 px-3 py-2">
            ✅ Administración: pagos pendientes y renovaciones
          </div>
          <div className="rounded-xl border bg-slate-50 px-3 py-2">
            ✅ Técnico: estado portal y tickets
          </div>
        </div>
      </Box>
    </div>
  );
}

function DashboardDireccion() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Socios (total)" value="256" sub="demo" />
        <KpiCard label="Altas mes" value="12" sub="demo" />
        <KpiCard label="Bajas mes" value="4" sub="demo" />
        <KpiCard label="Retención" value="96%" sub="demo" />
      </div>

      <Box title="Decisiones (demo)">
        <ul className="list-disc space-y-2 pl-5">
          <li>Definir foco comercial por rubro (Top 3) para Q1</li>
          <li>Priorizar mejoras del portal (autogestión + reportes por socio)</li>
          <li>Activar campaña de reactivación para socios inactivos</li>
        </ul>
      </Box>
    </div>
  );
}

function DashboardComercial() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Leads nuevos (7d)" value="23" sub="demo" />
        <KpiCard label="En seguimiento" value="18" sub="demo" />
        <KpiCard label="Calificados" value="9" sub="demo" />
        <KpiCard label="Cerrados" value="4" sub="demo (firma + pago)" />
      </div>

      <Box title="Pipeline (listado + aging) (demo)">
        <div className="flex flex-wrap gap-2">
          <PillLink href="/admin/leads?pipeline=Nuevo" label="Ver “Nuevo” (demo)" />
          <PillLink href="/admin/leads?pipeline=En%20seguimiento" label="Ver “En seguimiento” (demo)" />
          <PillLink href="/admin/leads?pipeline=Calificado" label="Ver “Calificado” (demo)" />
          <PillLink href="/admin/leads?pipeline=Cerrado" label="Ver “Cerrado” (demo)" />
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Nota: estos links abren Leads filtrados (por ahora). Más adelante armamos tabla/aging real dentro del dashboard.
        </div>
      </Box>

      <Box title="Acciones comerciales sugeridas (demo)">
        <ul className="list-disc space-y-2 pl-5">
          <li>Contactar hoy leads rating 4–5 sin actualización 30 días</li>
          <li>Revisión semanal del pipeline + responsables</li>
          <li>Objetivo: subir “calificados” y “cerrados” con seguimiento cadenciado</li>
        </ul>
      </Box>
    </div>
  );
}

function DashboardMarketing() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Leads (IG)" value="14" sub="demo" />
        <KpiCard label="Leads (Web)" value="9" sub="demo" />
        <KpiCard label="CTR" value="1.9%" sub="demo" />
        <KpiCard label="CAC estimado" value="$ 32" sub="demo" />
      </div>

      <Box title="Prioridades (demo)">
        <ul className="list-disc space-y-2 pl-5">
          <li>Campañas por rubro (creativos pastel + claim por beneficio)</li>
          <li>Automatización: lead → contacto → seguimiento</li>
          <li>Contenido: casos de socios + beneficios por segmento</li>
        </ul>
      </Box>
    </div>
  );
}

function DashboardAdministracion() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Pagos al día" value="214" sub="demo" />
        <KpiCard label="Pendientes" value="12" sub="demo" />
        <KpiCard label="Renovaciones (30d)" value="18" sub="demo" />
        <KpiCard label="Mora" value="4.5%" sub="demo" />
      </div>

      <Box title="Tareas (demo)">
        <ul className="list-disc space-y-2 pl-5">
          <li>Recordatorios automáticos de pago</li>
          <li>Plan de renovaciones (contacto + factura + confirmación)</li>
          <li>Conciliación mensual (eventos/servicios)</li>
        </ul>
      </Box>
    </div>
  );
}

function DashboardTecnico() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Uptime" value="99.9%" sub="demo" />
        <KpiCard label="Tickets abiertos" value="7" sub="demo" />
        <KpiCard label="Incidentes" value="1" sub="demo" />
        <KpiCard label="Deploys" value="3" sub="demo" />
      </div>

      <Box title="Backlog (demo)">
        <ul className="list-disc space-y-2 pl-5">
          <li>Dashboard socios (versión socio)</li>
          <li>Reportes exportables con filtros (fecha/rubro/país)</li>
          <li>Mejoras performance + control de permisos</li>
        </ul>
      </Box>
    </div>
  );
}

function ReportesPlaceholder() {
  return (
    <div className="space-y-4">
      <Box title="Reportes (demo)">
        <div className="text-sm text-slate-700">
          Acá van los <span className="font-semibold">listados</span> con filtros (fecha, rubro, país, etc.).
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              Exportar CSV (demo)
            </span>
            <span className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              Filtros avanzados (demo)
            </span>
          </div>
        </div>
      </Box>
    </div>
  );
}

export function RolePanels({ variant }: { variant: Variant }) {
  const sp = useSearchParams();
  const tab = safeTab(sp.get("tab"));
  const area = TAB_LABEL[tab];

  const headerCls = TAB_PASTEL_BG[tab];

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${headerCls}`}>
        <div className="text-sm text-slate-700">
          <span className="font-semibold">Área: {area}</span>
          {variant === "dashboard" ? (
            <span> · KPIs + alertas ejecutivas (demo)</span>
          ) : (
            <span> · Reportes operativos (listados + filtros) (demo)</span>
          )}
        </div>
      </div>

      {variant === "reportes" ? (
        <ReportesPlaceholder />
      ) : tab === "resumen" ? (
        <DashboardResumen />
      ) : tab === "direccion" ? (
        <DashboardDireccion />
      ) : tab === "comercial" ? (
        <DashboardComercial />
      ) : tab === "marketing" ? (
        <DashboardMarketing />
      ) : tab === "administracion" ? (
        <DashboardAdministracion />
      ) : (
        <DashboardTecnico />
      )}
    </div>
  );
}