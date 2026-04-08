import Link from "next/link";
import EmpresasTable from "./EmpresasTable";

export const dynamic = "force-dynamic";

export default function EmpresasPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900">Iniciativas</h1>
            <p className="mt-1 text-sm text-slate-600">
              Bandeja para decidir rápido: filtrá por estado, convertí a lead o descartá desde cada fila. El detalle sigue
              disponible para editar datos finos antes de convertir.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cómo usarla</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-600">
                <li>
                  Arriba del listado: <strong className="font-medium text-slate-800">totales</strong> y chips{" "}
                  <strong className="font-medium text-slate-800">Todos / Nuevos / Revisados / Convertidos / Descartados</strong>{" "}
                  (solo en esta pantalla).
                </li>
                <li>
                  En cada fila hay un único botón verde{" "}
                  <strong className="font-medium text-slate-800">Convertir a Lead</strong>, más{" "}
                  <strong className="font-medium text-slate-800">Descartar</strong>,{" "}
                  <strong className="font-medium text-slate-800">Editar</strong> (datos básicos en modal) y{" "}
                  <strong className="font-medium text-slate-800">Detalle</strong>.
                </li>
                <li>
                  Altas masivas:{" "}
                  <Link href="/admin/empresas/importar" className="font-medium text-blue-700 hover:underline">
                    Importar
                  </Link>
                  . Alta manual:{" "}
                  <Link href="/admin/empresas/nueva" className="font-medium text-emerald-700 hover:underline">
                    Nueva iniciativa
                  </Link>
                  .
                </li>
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Los badges resumen el estado en cuatro grupos: Nuevo, Revisado, Convertido y Descartado.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
            <Link
              href="/admin/empresas/importar"
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Importar
            </Link>
            <Link
              href="/admin/empresas/nueva"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Nueva iniciativa
            </Link>
          </div>
        </div>
      </div>

      <EmpresasTable />
    </div>
  );
}