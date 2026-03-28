import Link from "next/link";
import EmpresasTable from "./EmpresasTable";
import {
  ESTADOS_REVISION_INICIATIVA,
  labelEstadoRevisionIniciativa,
} from "@/lib/crm/iniciativaEstadoRevision";

export const dynamic = "force-dynamic";

export default function EmpresasPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900">Iniciativas</h1>
            <p className="mt-1 text-sm text-slate-600">
              Ingreso preliminar y validación antes del <strong className="font-medium text-slate-800">lead</strong>{" "}
              comercial. Los datos viven aquí hasta que convertís; el lead queda con snapshot propio en LEADS87.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operación diaria</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-600">
                <li>
                  Usá <strong className="font-medium text-slate-800">búsqueda</strong> y{" "}
                  <strong className="font-medium text-slate-800">filtro por estado de revisión</strong> en el listado.
                </li>
                <li>
                  <strong className="font-medium text-slate-800">Ver</strong> abre la ficha: editar datos,{" "}
                  <span className="whitespace-nowrap">fuente remota</span>, score preliminar y{" "}
                  <strong className="font-medium text-slate-800">convertir a lead</strong> (una sola vez; si ya hay lead,
                  usá <strong className="font-medium text-slate-800">Abrir lead</strong>).
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
                Estados de revisión:{" "}
                {ESTADOS_REVISION_INICIATIVA.map((k) => labelEstadoRevisionIniciativa(k)).join(" · ")}.
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