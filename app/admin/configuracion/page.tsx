"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import RubrosTab from "./components/RubrosTab";
import PipelinesTab from "./components/PipelinesTab";
import EstadosTab from "./components/EstadosTab";
import RolesTab from "./components/RolesTab";

type Tab = "rubros" | "pipelines" | "estados" | "roles";

function ConfiguracionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as Tab) || "rubros";

  const setTab = (newTab: Tab) => {
    router.push(`/admin/configuracion?tab=${newTab}`);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "rubros", label: "Rubros" },
    { id: "pipelines", label: "Pipelines" },
    { id: "estados", label: "Estados" },
    { id: "roles", label: "Roles" },
  ];

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
              <p className="mt-1 text-sm text-slate-600">
                Administrá los rubros, pipelines, estados y roles del sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="inline-flex overflow-hidden rounded-xl border bg-slate-50">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-semibold transition ${
                  tab === t.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {tab === "rubros" && <RubrosTab />}
          {tab === "pipelines" && <PipelinesTab />}
          {tab === "estados" && <EstadosTab />}
          {tab === "roles" && <RolesTab />}
        </div>
      </div>
    </PageContainer>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={
      <PageContainer>
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="rounded-2xl border bg-white p-6">
            <div className="text-sm text-slate-500">Cargando...</div>
          </div>
        </div>
      </PageContainer>
    }>
      <ConfiguracionContent />
    </Suspense>
  );
}
