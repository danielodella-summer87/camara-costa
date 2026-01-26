"use client";

import { useState } from "react";
import PersonalizacionTab from "../configuracion/components/PersonalizacionTab";
import LicenciaTab from "../configuracion/components/LicenciaTab";

type TabId = "cliente_socio" | "licencia";

const TABS: { id: TabId; label: string }[] = [
  { id: "cliente_socio", label: "Cliente / Socio" },
  { id: "licencia", label: "Licencia" },
];

export default function PersonalizacionPage() {
  const [tab, setTab] = useState<TabId>("cliente_socio");

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="rounded-2xl border bg-white p-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Personalización</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Configuración global de nombres y textos.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "rounded-xl border px-3 py-1.5 text-xs font-semibold",
                tab === t.id
                  ? "bg-slate-100 text-slate-900"
                  : "bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "cliente_socio" && <PersonalizacionTab />}
          {tab === "licencia" && <LicenciaTab />}
        </div>
      </div>
    </div>
  );
}
