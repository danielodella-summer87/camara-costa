"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import RubrosTab from "./components/RubrosTab";
import PipelinesTab from "./components/PipelinesTab";
import EstadosTab from "./components/EstadosTab";
import RolesTab from "./components/RolesTab";
import ComercialesTab from "./components/ComercialesTab";
import { AlertTriangle } from "lucide-react";
import { InitiativeLeadsPolicyCard } from "./components/InitiativeLeadsPolicyCard";

type Tab = "rubros" | "pipelines" | "estados" | "roles" | "comerciales";

function ConfiguracionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as Tab) || "rubros";
  const [activatingSetup, setActivatingSetup] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean>(false);
  const [setupStatusLoaded, setSetupStatusLoaded] = useState(false);
  const [setupCreated, setSetupCreated] = useState<string[]>([]);
  const [setupSkipped, setSetupSkipped] = useState<string[]>([]);
  const [setupErr, setSetupErr] = useState<string | null>(null);

  const setTab = (newTab: Tab) => {
    router.push(`/admin/configuracion?tab=${newTab}`);
  };

  async function loadSetupStatus() {
    try {
      const res = await fetch("/api/admin/setup/minimal-seed", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok === true) {
        setSetupCompleted(Boolean(json?.setup_completed));
      }
    } finally {
      setSetupStatusLoaded(true);
    }
  }

  useEffect(() => {
    void loadSetupStatus();
  }, []);

  async function activateMinimalSetup() {
    setActivatingSetup(true);
    setSetupCreated([]);
    setSetupSkipped([]);
    setSetupErr(null);
    try {
      const res = await fetch("/api/admin/setup/minimal-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "No se pudo ejecutar el setup mínimo.");
      }
      setSetupCreated(Array.isArray(json?.created) ? json.created.map(String) : []);
      setSetupSkipped(Array.isArray(json?.skipped) ? json.skipped.map(String) : []);
      setSetupCompleted(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo ejecutar el setup mínimo.";
      setSetupErr(msg);
    } finally {
      setActivatingSetup(false);
    }
  }

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
              <p className="mt-2 text-xs text-slate-500">
                Carga datos demo mínimos para activar la instancia.
              </p>
              {setupCreated.length > 0 ? (
                <p className="mt-2 text-xs text-emerald-700">
                  Creados: {setupCreated.join(" · ")}
                </p>
              ) : null}
              {setupSkipped.length > 0 ? (
                <p className="mt-1 text-xs text-slate-600">
                  Omitidos: {setupSkipped.join(" · ")}
                </p>
              ) : null}
              {setupErr ? <p className="mt-2 text-xs text-red-700">{setupErr}</p> : null}
            </div>
            {setupStatusLoaded && !setupCompleted ? (
              <button
                type="button"
                onClick={() => void activateMinimalSetup()}
                disabled={activatingSetup}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                  activatingSetup
                    ? "cursor-not-allowed bg-slate-400"
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {activatingSetup ? "Activando..." : "Activar datos de setup"}
              </button>
            ) : null}
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
          <Link
            href="/admin/configuracion/servicios"
            className="rounded-2xl border bg-white p-4 hover:bg-slate-50 transition"
          >
            <div className="text-sm font-semibold text-slate-900">Servicios de la agencia</div>
            <div className="mt-1 text-xs text-slate-600">
              Catálogo maestro (precio, unidad, cantidad sugerida) usado al armar propuestas comerciales.
            </div>
          </Link>
        </div>

        <InitiativeLeadsPolicyCard />

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
