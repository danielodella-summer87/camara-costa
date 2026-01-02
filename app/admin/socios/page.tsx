import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

// ✅ Evita cache estático
export const dynamic = "force-dynamic";
export const revalidate = 0;

function semaforoDotClass(raw: unknown) {
  const s = (raw ?? "").toString().trim().toLowerCase();

  if (s === "rojo") return "bg-red-500";
  if (s === "amarillo") return "bg-yellow-400";
  if (s === "verde") return "bg-green-500";

  return "bg-slate-300";
}

export default async function SociosPage() {
  const { data: socios, error } = await supabaseServer
    .from("v_socio_inteligente")
    .select("id,nombre,plan,estado,alta,semaforo,proxima_accion")
    .order("id");

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
            {(socios ?? []).map((socio) => (
              <tr
                key={socio.id}
                className="border-b transition hover:bg-slate-50"
              >
                <td className="p-3 font-mono whitespace-nowrap">{socio.id}</td>
                <td className="p-3 font-medium">{socio.nombre}</td>
                <td className="p-3 whitespace-nowrap">{socio.plan}</td>
                <td className="p-3 whitespace-nowrap">{socio.estado}</td>

                <td className="p-3 text-slate-700 whitespace-nowrap">
                  {socio.alta ?? "—"}
                </td>

                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded-full ${semaforoDotClass(
                        socio.semaforo
                      )} ring-1 ring-black/10`}
                      title={`Semáforo: ${socio.semaforo ?? "—"}`}
                    />
                    <span className="text-xs text-slate-600">
                      {socio.proxima_accion ?? "—"}
                    </span>
                  </div>
                </td>

                <td className="p-3 text-right whitespace-nowrap">
                  <Link
                    href={`/admin/socios/${socio.id}`}
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-100"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}

            {(!socios || socios.length === 0) && (
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