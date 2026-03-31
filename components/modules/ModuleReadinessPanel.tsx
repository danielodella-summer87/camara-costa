"use client";

import type { ModuleId, ModuleReadinessResult } from "@/lib/modules/types";

type Props = {
  moduleId: ModuleId;
  readiness: ModuleReadinessResult | null;
  loading?: boolean;
  initializing?: boolean;
  onInitialize?: () => void | Promise<void>;
  /** Estado vacío (tabla sin filas) */
  emptyHint?: string;
  onCreateFirst?: () => void;
  createFirstLabel?: string;
};

export function ModuleReadinessPanel({
  moduleId,
  readiness,
  loading,
  initializing,
  onInitialize,
  emptyHint = "No hay datos aún.",
  onCreateFirst,
  createFirstLabel = "Crear primero",
}: Props) {
  if (loading || !readiness) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Comprobando módulo…
      </div>
    );
  }

  if (readiness.status === "missing_schema") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">Módulo no inicializado</p>
        <p className="mt-1 text-amber-900/90">
          {moduleId === "ia_categories"
            ? "Falta la tabla ai_categories (o el esquema IA). Podés crearla con el SQL indicado al inicializar."
            : moduleId === "leads_linkedin_personal"
              ? "Falta la tabla leads o la columna linkedin_personal. Seguí los pasos del asistente de inicialización."
              : "Esquema incompleto para este módulo."}
        </p>
        {onInitialize ? (
          <button
            type="button"
            disabled={initializing}
            onClick={() => void onInitialize()}
            className="mt-3 rounded-lg bg-amber-800 px-3 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-60"
          >
            {initializing ? "Procesando…" : "Inicializar módulo"}
          </button>
        ) : null}
      </div>
    );
  }

  if (readiness.status === "empty") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        <p>{emptyHint}</p>
        {onCreateFirst ? (
          <button
            type="button"
            onClick={onCreateFirst}
            className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {createFirstLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}
