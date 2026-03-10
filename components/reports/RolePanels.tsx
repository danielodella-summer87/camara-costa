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

/**
 * ✅ Banner “Área: …” con HEX (igual que los tabs) => nunca queda blanco
 * Usamos bgActive y borderActive equivalentes a RoleTabs.
 */
const BANNER_THEME: Record<
  TabKey,
  { bg: string; border: string; text: string }
> = {
  resumen: { bg: "#D6ECFF", border: "#7BBEFF", text: "#0B3B73" },
  direccion: { bg: "#E0E7FF", border: "#A5B4FC", text: "#2C2C7A" },
  comercial: { bg: "#FFEAB0", border: "#F0C14B", text: "#5B3A00" },
  marketing: { bg: "#FFD6E8", border: "#FF87B9", text: "#7A1E45" },
  administracion: { bg: "#D6F7E3", border: "#6ED39B", text: "#0F5132" },
  tecnico: { bg: "#E7DCFF", border: "#B08CFF", text: "#3B1F72" }, // ✅ violeta, no blanco
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

function PillLink({ href, label }: { href: string; label: string }) {
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
            <li>
              9 socios con riesgo de baja (rating alto + 30 días sin actualización)
            </li>
            <li>3 oportunidades comerciales listas para propuesta</li>
            <li>2 eventos próximos con cupos críticos</li>
          </ul>
        </Box>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Actividad comercial</div>
          <p className="mt-2 text-sm text-slate-600">
            La ejecución diaria (tareas, reuniones, llamadas) está en Agenda.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-500 sm:grid-cols-3">
            <span>Tareas vencidas: —</span>
            <span>Reuniones hoy: —</span>
            <span>Llamadas pendientes: —</span>
          </div>
          <div className="mt-4">
            <Link
              href="/admin/agenda"
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ver Agenda
            </Link>
          </div>
        </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Dashboard Comercial</h2>
      <p className="mt-2 text-sm text-slate-600">
        El dashboard comercial fue movido a su módulo principal.
      </p>
      <div className="mt-4">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 hover:border-emerald-700"
        >
          Ir al Dashboard Comercial
        </Link>
      </div>
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
          Acá van los <span className="font-semibold">listados</span> con filtros
          (fecha, rubro, país, etc.).
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

  const theme = BANNER_THEME[tab];

  return (
    <div className="space-y-4">
      {/* ✅ Banner área: ahora SIEMPRE pastel por HEX (no depende de Tailwind) */}
      <div
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
        }}
      >
        <div className="text-sm" style={{ color: theme.text }}>
          <span className="font-semibold">Área: {area}</span>
          {variant === "dashboard" && tab === "comercial" ? (
            <span> · El dashboard comercial está en su módulo principal</span>
          ) : variant === "dashboard" ? (
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