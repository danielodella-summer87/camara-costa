import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

// ✅ Evita cache estático
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SociosPage() {
  // Consultar socios con join a empresas
  const { data, error } = await supabaseServer
    .from("socios")
    .select("id, codigo, plan, estado, fecha_alta, proxima_accion, empresa_id, empresas:empresa_id(id,nombre)")
    .order("fecha_alta", { ascending: false });

  if (error) {
    return (
      <div className="p-10 text-red-600">
        Error cargando socios: {error.message}
      </div>
    );
  }

  return (
    <div className="max-w-[1200px]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Socios</h1>
          <p className="text-slate-600">Gestión con inteligencia comercial</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Empresa</th>
              <th className="p-3 text-left">Plan</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-left">Alta</th>
              <th className="p-3 text-left">Próxima acción</th>
              <th className="p-3"></th>
            </tr>
          </thead>

          <tbody>
            {(data ?? []).map((row: any) => (
              <tr
                key={row.id}
                className="border-b transition hover:bg-slate-50"
              >
                <td className="p-3 font-mono whitespace-nowrap">{row.codigo ?? row.id}</td>
                <td className="p-3 font-medium">{(row.empresas as any)?.nombre ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{row.plan ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{row.estado ?? "—"}</td>

                <td className="p-3 text-slate-700 whitespace-nowrap">
                  {row.fecha_alta ?? "—"}
                </td>

                <td className="p-3">
                  <span className="text-xs text-slate-600">
                    {row.proxima_accion ?? "—"}
                  </span>
                </td>

                <td className="p-3 text-right whitespace-nowrap">
                  <Link
                    href={`/admin/socios/${row.id}`}
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-100"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}

            {(!data || data.length === 0) && (
              <tr>
                <td className="p-6 text-slate-500" colSpan={7}>
                  No hay socios para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
