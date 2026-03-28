"use client";

import type { IATabKey } from "./types";

const TABS: Array<{ key: IATabKey; label: string }> = [
  { key: "dashboard_ia", label: "Dashboard IA" },
  { key: "configuracion", label: "Configuración" },
  { key: "prompts_activos", label: "Prompts Activos" },
  { key: "categorias", label: "Categorías" },
  { key: "perfiles_analisis", label: "Perfiles de análisis" },
];

export function IATabs({
  active,
  onChange,
}: {
  active: IATabKey;
  onChange: (next: IATabKey) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
