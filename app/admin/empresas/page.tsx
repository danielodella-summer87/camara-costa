import Link from "next/link";
import EmpresasTable from "./EmpresasTable";

export const dynamic = "force-dynamic";

export default function EmpresasPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Empresas</h1>
            <p className="mt-1 text-sm text-slate-600">
              Directorio, aprobación, edición, rubros.
            </p>
          </div>
        </div>
      </div>

      <EmpresasTable />
    </div>
  );
}