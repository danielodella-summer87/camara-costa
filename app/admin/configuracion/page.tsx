"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import RubrosTab from "./components/RubrosTab";
import PipelinesTab from "./components/PipelinesTab";
import EstadosTab from "./components/EstadosTab";
import RolesTab from "./components/RolesTab";
import ComercialesTab from "./components/ComercialesTab";
import { AlertTriangle } from "lucide-react";

type Tab = "rubros" | "pipelines" | "estados" | "roles" | "comerciales";

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
    { id: "comerciales", label: "Comerciales" },
  ];

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
              <p className="mt-1 text-sm text-slate-600">
                Administrá los rubros, pipelines, estados, roles y comerciales del sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Links rápidos (config.admin: layout ya restringe acceso) */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/configuracion/usuarios"
            className="rounded-2xl border bg-white p-4 hover:bg-slate-50 transition"
          >
            <div className="text-sm font-semibold text-slate-900">Usuarios</div>
            <div className="mt-1 text-xs text-slate-600">
              Ver usuarios, rol asignado y permisos efectivos (solo lectura).
            </div>
          </Link>
          <Link
            href="/admin/configuracion/roles"
            className="rounded-2xl border bg-white p-4 hover:bg-slate-50 transition"
          >
            <div className="text-sm font-semibold text-slate-900">Roles</div>
            <div className="mt-1 text-xs text-slate-600">
              Ver roles del sistema y permisos asignados a cada uno (solo lectura).
            </div>
          </Link>
          <Link
            href="/admin/configuracion/comerciales"
            className="rounded-2xl border bg-white p-4 hover:bg-slate-50 transition"
          >
            <div className="text-sm font-semibold text-slate-900">Comerciales</div>
            <div className="mt-1 text-xs text-slate-600">
              Gestioná el equipo comercial (vendedores) para asignarlos a leads.
            </div>
          </Link>
          <Link
            href="/admin/configuracion/modulos-menu"
            className="rounded-2xl border bg-white p-4 hover:bg-slate-50 transition"
          >
            <div className="text-sm font-semibold text-slate-900">Módulos y menú</div>
            <div className="mt-1 text-xs text-slate-600">
              Estado del menú lateral (activo, en preparación, oculto), iconos y etiquetas.
            </div>
          </Link>
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
          {tab === "comerciales" && <ComercialesTab />}
        </div>

        {/* Zona peligrosa */}
        <ZonaPeligrosa />
      </div>
    </PageContainer>
  );
}

function ZonaPeligrosa() {
  const [resetting, setResetting] = useState(false);

  async function resetDB() {
    const first = prompt('Escribí BORRAR TODO para confirmar:');
    if (first !== "BORRAR TODO") return;

    const second = confirm("Última confirmación: esto borra TODOS los datos. ¿Seguro?");
    if (!second) return;

    setResetting(true);
    try {
      const res = await fetch("/api/admin/config/reset-db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: "BORRAR TODO" }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json?.error ?? "Error");
        return;
      }
      alert("Listo: base limpiada.");
    } catch (e) {
      const error = e instanceof Error ? e.message : "Error inesperado";
      alert(`Error: ${error}`);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-4">
        <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-red-900">Zona peligrosa</h2>
          <p className="mt-1 text-sm text-red-700">
            Esta acción borra TODOS los datos de la base de datos. No se puede deshacer.
          </p>
          <button
            type="button"
            onClick={resetDB}
            disabled={resetting}
            className={`mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
              resetting
                ? "bg-red-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {resetting ? "Reseteando..." : "Borrar toda la base de datos"}
          </button>
        </div>
      </div>
    </div>
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
