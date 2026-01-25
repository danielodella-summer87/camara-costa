import Link from "next/link";
import EmpresasTable from "./EmpresasTable";

export const dynamic = "force-dynamic";

export default function EmpresasPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Entidades</h1>
            <p className="mt-1 text-sm text-slate-600">
              Directorio de entidades. Aprobación, edición, rubros.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/empresas/importar"
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Importar
            </Link>
            <Link
              href="/admin/empresas/nueva"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Nueva entidad
            </Link>
          </div>
        </div>
      </div>

      <EmpresasTable />
    </div>
  );
}