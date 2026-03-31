"use client";

/**
 * Vista de decisión: sin inputs — solo lectura + acción "Agregar a propuesta".
 */
export function SuggestedServiceCard({
  titulo,
  categoria,
  prioridadBadgeClass,
  prioridadCorta,
  diagnostico,
  implicancia,
  impacto,
  onAgregar,
  disabled,
}: {
  titulo: string;
  categoria?: string | null;
  prioridadBadgeClass: string;
  prioridadCorta: string;
  diagnostico: string;
  implicancia: string;
  impacto: string;
  onAgregar: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-snug text-slate-900">{titulo}</h3>
            {categoria?.trim() ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {categoria.trim()}
              </span>
            ) : null}
            <span className={prioridadBadgeClass} title={`Prioridad ${prioridadCorta}`}>
              {prioridadCorta}
            </span>
          </div>
          <div className="mt-2.5 max-w-prose space-y-1.5 text-xs leading-relaxed text-gray-600">
            <p>{diagnostico}</p>
            <p>{implicancia}</p>
            <p className="font-medium text-gray-700">{impacto}</p>
          </div>
        </div>
        <div className="shrink-0 self-start pt-0.5">
          <button
            type="button"
            onClick={onAgregar}
            disabled={disabled}
            className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Agregar a propuesta
          </button>
        </div>
      </div>
    </div>
  );
}
