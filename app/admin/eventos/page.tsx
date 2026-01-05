"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

type EventStatus = "BORRADOR" | "PUBLICADO" | "CERRADO" | "FINALIZADO";

type Evento = {
  id: string;
  titulo: string;
  fechaISO: string; // ISO string
  modalidad: "Presencial" | "Online" | "Híbrido";
  lugar?: string;
  cuposTotal: number;
  cuposOcupados: number;
  estado: EventStatus;
  rubro?: string;
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-UY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysFromNow(iso: string) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function badgeCls(status: EventStatus) {
  switch (status) {
    case "PUBLICADO":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "BORRADOR":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "CERRADO":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "FINALIZADO":
      return "bg-violet-50 text-violet-800 border-violet-200";
  }
}

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

export default function AdminEventosPage() {
  // ✅ DEMO DATA (luego lo conectamos a DB)
  const demo: Evento[] = [
    {
      id: "evt_001",
      titulo: "Networking Empresarial – Enero",
      fechaISO: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      modalidad: "Presencial",
      lugar: "Cámara Costa – Sala Principal",
      cuposTotal: 80,
      cuposOcupados: 62,
      estado: "PUBLICADO",
      rubro: "General",
    },
    {
      id: "evt_002",
      titulo: "Taller: Ventas B2B para socios",
      fechaISO: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
      modalidad: "Híbrido",
      lugar: "Cámara Costa + Zoom",
      cuposTotal: 50,
      cuposOcupados: 47,
      estado: "PUBLICADO",
      rubro: "Comercial",
    },
    {
      id: "evt_003",
      titulo: "Webinar: Beneficios y descuentos 2026",
      fechaISO: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
      modalidad: "Online",
      cuposTotal: 300,
      cuposOcupados: 122,
      estado: "PUBLICADO",
      rubro: "Socios",
    },
    {
      id: "evt_004",
      titulo: "Ronda de negocios (borrador)",
      fechaISO: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
      modalidad: "Presencial",
      lugar: "A confirmar",
      cuposTotal: 60,
      cuposOcupados: 0,
      estado: "BORRADOR",
      rubro: "Dirección",
    },
    {
      id: "evt_005",
      titulo: "Encuentro anual de socios (cerrado)",
      fechaISO: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
      modalidad: "Presencial",
      lugar: "Hotel — (demo)",
      cuposTotal: 120,
      cuposOcupados: 120,
      estado: "CERRADO",
      rubro: "General",
    },
  ];

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<EventStatus | "">( "");
  const [onlyCritical, setOnlyCritical] = useState(false);

  const rows = useMemo(() => {
    const qn = q.trim().toLowerCase();
    return demo
      .slice()
      .sort((a, b) => new Date(a.fechaISO).getTime() - new Date(b.fechaISO).getTime())
      .filter((e) => {
        if (status && e.estado !== status) return false;
        if (qn) {
          const hay = `${e.titulo} ${e.modalidad} ${e.lugar ?? ""} ${e.rubro ?? ""}`.toLowerCase();
          if (!hay.includes(qn)) return false;
        }
        if (onlyCritical) {
          const left = e.cuposTotal - e.cuposOcupados;
          if (left > 10) return false; // crítico <= 10 cupos
        }
        return true;
      });
  }, [demo, q, status, onlyCritical]);

  const kpis = useMemo(() => {
    const in7 = demo.filter((e) => daysFromNow(e.fechaISO) >= 0 && daysFromNow(e.fechaISO) <= 7);
    const in30 = demo.filter((e) => daysFromNow(e.fechaISO) >= 0 && daysFromNow(e.fechaISO) <= 30);
    const critical = demo.filter((e) => (e.cuposTotal - e.cuposOcupados) <= 10 && e.estado === "PUBLICADO");
    const inscripciones = demo.reduce((acc, e) => acc + e.cuposOcupados, 0);
    return { in7: in7.length, in30: in30.length, critical: critical.length, inscripciones };
  }, [demo]);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl border bg-cyan-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-900">Eventos</h1>
              <p className="mt-1 text-sm text-slate-700">
                Vista operativa (demo): próximos eventos, cupos, alertas y acciones.
              </p>

              <div className="mt-3 inline-flex overflow-hidden rounded-xl border bg-white">
                <Link
                  href="/admin"
                  className="px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                >
                  ← Volver a Dashboard
                </Link>
                <span className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-900">
                  Eventos
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
                title="(demo) luego lo conectamos a crear evento"
                onClick={() => alert("Próximamente: Crear evento (demo)")}
              >
                + Nuevo evento
              </button>
              <button
                type="button"
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
                title="(demo) luego export real"
                onClick={() => alert("Próximamente: Exportar CSV (demo)")}
              >
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <KpiCard label="Próximos 7 días" value={`${kpis.in7}`} sub="demo" />
            <KpiCard label="Próximos 30 días" value={`${kpis.in30}`} sub="demo" />
            <KpiCard label="Cupos críticos" value={`${kpis.critical}`} sub="≤ 10 cupos (demo)" />
            <KpiCard label="Inscripciones total" value={`${kpis.inscripciones}`} sub="demo" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2 rounded-2xl border bg-white p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Listado (demo)</div>
                  <div className="text-xs text-slate-500">
                    Buscá por título/lugar/rubro o filtrá por estado. “Críticos” = cupos ≤ 10.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="w-64 rounded-xl border px-3 py-2 text-sm"
                    placeholder="Buscar…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <select
                    className="rounded-xl border px-3 py-2 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="">Todos</option>
                    <option value="PUBLICADO">PUBLICADO</option>
                    <option value="BORRADOR">BORRADOR</option>
                    <option value="CERRADO">CERRADO</option>
                    <option value="FINALIZADO">FINALIZADO</option>
                  </select>

                  <label className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={onlyCritical}
                      onChange={(e) => setOnlyCritical(e.target.checked)}
                    />
                    Críticos
                  </label>
                </div>
              </div>

              <div className="mt-4 overflow-auto rounded-xl border">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Evento</th>
                      <th className="px-4 py-3">Modalidad</th>
                      <th className="px-4 py-3">Cupos</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 text-slate-600">
                          Sin resultados.
                        </td>
                      </tr>
                    ) : (
                      rows.map((e) => {
                        const left = e.cuposTotal - e.cuposOcupados;
                        const critical = left <= 10 && e.estado === "PUBLICADO";
                        return (
                          <tr key={e.id} className="border-b last:border-b-0">
                            <td className="px-4 py-3">{fmtDateTime(e.fechaISO)}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{e.titulo}</div>
                              <div className="text-xs text-slate-500">
                                {e.lugar ? e.lugar : "—"} {e.rubro ? `· ${e.rubro}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3">{e.modalidad}</td>
                            <td className="px-4 py-3">
                              {e.cuposOcupados}/{e.cuposTotal}{" "}
                              <span className={`ml-2 text-xs ${critical ? "text-amber-800" : "text-slate-500"}`}>
                                {critical ? `⚠️ Quedan ${left}` : `Quedan ${left}`}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${badgeCls(e.estado)}`}>
                                {e.estado}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                className="rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={() => alert(`Próximamente: Detalle/editar ${e.id} (demo)`)}
                              >
                                Ver / Editar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-slate-600">
                Filas: <span className="font-semibold">{rows.length}</span> (demo)
              </div>
            </div>

            <div className="space-y-4">
              <Box title="Alertas rápidas (demo)">
                <ul className="list-disc space-y-2 pl-5">
                  <li>1 evento con cupos críticos → empujar campaña de último cupo</li>
                  <li>2 eventos en 7 días → confirmar logística + speakers</li>
                  <li>1 borrador → decidir si se publica o se cancela</li>
                </ul>
              </Box>

              <Box title="Acciones sugeridas (demo)">
                <ul className="space-y-2">
                  <li>📩 Email/WhatsApp a socios segmentados (por rubro)</li>
                  <li>📣 Post IG/LinkedIn “últimos cupos” para eventos críticos</li>
                  <li>🧾 Checklist operativo: sala / streaming / registro</li>
                </ul>
              </Box>

              <Box title="Próximo paso (cuando conectemos DB)">
                <div className="text-sm text-slate-700">
                  1) Tabla real de eventos <br />
                  2) Crear/editar evento <br />
                  3) Inscripciones + cupos <br />
                  4) Reportes: asistentes, no-shows, ingresos por evento
                </div>
              </Box>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}