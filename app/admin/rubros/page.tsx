import Link from "next/link";
import RubrosTable from "./RubrosTable";

export const dynamic = "force-dynamic";

export default function AdminRubrosPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Rubros</h1>
            <p className="mt-1 text-sm text-slate-600">
              Alta, baja y modificación de rubros del directorio.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/empresas"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Volver a Empresas
            </Link>
          </div>
        </div>
      </div>

      <RubrosTable />
    </div>
  );
}