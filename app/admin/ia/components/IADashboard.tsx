"use client";

import { useState } from "react";
import { categoryPastelSurfaceClass, getCategoryPastelClasses } from "./categoryPastel";

export type DashboardData = {
  header: {
    active_profile_name: string;
    active_prompts_count: number;
    system_status: string;
    last_execution: string | null;
  };
  profile_control: {
    active_profile_id: string;
    active_profile_name: string;
    profiles: Array<{ id: string; name: string; is_active: boolean }>;
    associated_prompts_count: number;
    execution_order: Array<{ prompt_id: string; prompt_name: string; execution_order: number }>;
  };
  recent_executions: Array<{
    lead: string;
    profile: string;
    prompts_executed: number;
    duration: number | null;
    status: "OK" | "ERROR";
    executed_at: string | null;
  }>;
  insights: {
    posicionamiento_issues_pct: number;
    no_digital_strategy_pct: number;
    recurring_opportunities_pct: number;
    sample_size: number;
  };
  quality: {
    active_prompts: number;
    prompts_without_structure: number;
    prompts_with_errors: number;
  };
  /** Prompts con `enabled_by_default` en el perfil activo, agrupados por categoría. */
  prompts_by_category: Array<{ category_name: string; count: number }>;
};

function Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
      {text}
    </span>
  );
}

export function IADashboard({
  data,
  onSelectProfile,
  switchingProfile,
}: {
  data: DashboardData | null;
  onSelectProfile: (profileId: string) => void;
  switchingProfile: boolean;
}) {
  const [isExecutionOrderOpen, setIsExecutionOrderOpen] = useState(false);
  const [isPromptsByCategoryOpen, setIsPromptsByCategoryOpen] = useState(false);

  if (!data) return <div className="text-sm text-slate-500">Cargando dashboard…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Dashboard IA</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Perfil activo</p>
            <p className="text-sm font-semibold text-slate-900">{data.header.active_profile_name}</p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Prompts validados (catálogo)</p>
            <p className="text-sm font-semibold text-slate-900">{data.header.active_prompts_count}</p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Estado del sistema</p>
            <p className="text-sm font-semibold text-slate-900">{data.header.system_status}</p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Última ejecución</p>
            <p className="text-sm font-semibold text-slate-900">
              {data.header.last_execution ? new Date(data.header.last_execution).toLocaleString("es-UY") : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900">Control de perfil</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Perfil activo actual</p>
            <p className="text-sm font-semibold text-slate-900">{data.profile_control.active_profile_name}</p>
            <select
              value={data.profile_control.active_profile_id}
              onChange={(e) => onSelectProfile(e.target.value)}
              disabled={switchingProfile}
              className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
            >
              {data.profile_control.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-600">
              Prompts en este perfil (habilitados): {data.profile_control.associated_prompts_count}
            </p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <button
              type="button"
              onClick={() => setIsExecutionOrderOpen((prev) => !prev)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md text-left outline-none ring-slate-400 focus-visible:ring-2"
              aria-expanded={isExecutionOrderOpen}
            >
              <span className="w-4 shrink-0 text-center text-xs text-slate-500" aria-hidden>
                {isExecutionOrderOpen ? "↓" : "→"}
              </span>
              <span className="text-xs font-semibold text-slate-700">Orden de ejecución</span>
            </button>
            {isExecutionOrderOpen ? (
              <ol className="mt-2 space-y-1 text-xs text-slate-700">
                {data.profile_control.execution_order.map((row) => (
                  <li key={row.prompt_id}>
                    {row.execution_order}. {row.prompt_name}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setIsPromptsByCategoryOpen((prev) => !prev)}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md text-left outline-none ring-slate-400 focus-visible:ring-2"
          aria-expanded={isPromptsByCategoryOpen}
        >
          <span className="w-4 shrink-0 text-center text-xs text-slate-500" aria-hidden>
            {isPromptsByCategoryOpen ? "↓" : "→"}
          </span>
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-slate-900">Prompts por categoría</span>
            <span className="text-xs font-normal text-slate-500">
              (
              {(data.prompts_by_category ?? []).length}{" "}
              {(data.prompts_by_category ?? []).length === 1 ? "categoría" : "categorías"})
            </span>
          </span>
        </button>
        {isPromptsByCategoryOpen ? (
          <>
            <p className="mt-2 text-xs text-slate-500">
              Solo prompts habilitados por defecto en el perfil activo ({data.profile_control.active_profile_name}).
            </p>
            {(data.prompts_by_category ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No hay prompts asociados a este perfil o ninguno está habilitado por defecto.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(data.prompts_by_category ?? []).map((row) => {
                  const pastel = getCategoryPastelClasses(
                    row.category_name === "Sin categoría" ? null : row.category_name
                  );
                  const surface = categoryPastelSurfaceClass(
                    row.category_name === "Sin categoría" ? null : row.category_name
                  );
                  return (
                    <li
                      key={row.category_name}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${surface}`}
                    >
                      <span className={`font-medium ${pastel.text}`}>{row.category_name}</span>
                      <span className={`font-semibold tabular-nums ${pastel.text}`}>{row.count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900">Ejecuciones recientes</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">Lead</th>
                <th className="py-2 pr-3">Perfil</th>
                <th className="py-2 pr-3">Prompts</th>
                <th className="py-2 pr-3">Duración</th>
                <th className="py-2 pr-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_executions.slice(0, 10).map((r, idx) => (
                <tr key={`${r.lead}-${idx}`} className="border-t">
                  <td className="py-2 pr-3 text-slate-800">{r.lead}</td>
                  <td className="py-2 pr-3 text-slate-700">{r.profile}</td>
                  <td className="py-2 pr-3 text-slate-700">{r.prompts_executed}</td>
                  <td className="py-2 pr-3 text-slate-700">{r.duration == null ? "—" : `${r.duration}s`}</td>
                  <td className="py-2 pr-3">
                    <Badge ok={r.status === "OK"} text={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">Insights del motor</h4>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>% leads con problemas de posicionamiento: <span className="font-semibold">{data.insights.posicionamiento_issues_pct}%</span></p>
            <p>% leads sin estrategia digital: <span className="font-semibold">{data.insights.no_digital_strategy_pct}%</span></p>
            <p>% oportunidades recurrentes: <span className="font-semibold">{data.insights.recurring_opportunities_pct}%</span></p>
            <p className="text-xs text-slate-500">Base muestral: {data.insights.sample_size} ejecuciones con reporte.</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">Calidad del sistema</h4>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>Validados en catálogo: <span className="font-semibold">{data.quality.active_prompts}</span></p>
            <p>Prompts sin estructura: <span className="font-semibold">{data.quality.prompts_without_structure}</span></p>
            <p>Prompts con errores: <span className="font-semibold">{data.quality.prompts_with_errors}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

