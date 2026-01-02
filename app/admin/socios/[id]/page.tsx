import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

// Evita cache estático (para que refleje cambios del view sin “quedarse viejo”)
export const dynamic = "force-dynamic";
export const revalidate = 0;

function semaforoColor(raw: unknown) {
  const accion = (raw ?? "").toString().toLowerCase();

  if (!accion) return "bg-slate-300"; // sin dato -> gris

  if (accion.includes("activar")) return "bg-red-500";
  if (accion.includes("seguimiento")) return "bg-yellow-400";
  if (accion.includes("ok") || accion.includes("mantener")) return "bg-green-500";

  return "bg-slate-400";
}

function formatAlta(raw: unknown) {
  if (!raw) return "—";
  // si ya viene "YYYY-MM-DD" lo mostramos tal cual
  const s = raw.toString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // si viene timestamp, intentamos parsear
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
}

export default async function SociosPage() {
  const { data: socios, error } = await supabaseServer
    .from("v_socio_inteligente")
    .select("id,nombre,plan,estado,fecha_alta,proxima_accion")
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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Socios</h1>
          <p className="text-slate-600">Gestióná socios, estados y planes.</p>
        </div>

        <Link
          href="/admin/socios/nuevo"
          className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
        >
          + Nuevo socio
        </Link>
      </div>

      {/* Barra superior (puede quedar como UI; si después querés, lo hacemos funcional) */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          className="h-10 w-[260px] rounded-xl border px-4 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          placeholder="Buscar por nombre..."
        />
        <select className="h-10 rounded-xl border px-4 text-sm">
          <option>Todos los estados</option>
          <option>Activo</option>
          <option>Pendiente</option>
          <option>Vencido</option>
        </select>
        <select className="h-10 rounded-xl border px-4 text-sm">
          <option>Todos los planes</option>
          <option>Oro</option>
          <option>Plata</option>
          <option>Bronce</option>
        </select>
        <button className="h-10 rounded-xl border px-6 text-sm hover:bg-slate-50">
          Limpiar
        </button>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
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
            {(socios ?? []).map((socio: any) => (
              <tr key={socio.id} className="border-b hover:bg-slate-50 transition">
                <td className="p-3 font-mono">{socio.id}</td>
                <td className="p-3 font-medium">{socio.nombre}</td>
                <td className="p-3">{socio.plan}</td>
                <td className="p-3">{socio.estado}</td>
                <td className="p-3">{formatAlta(socio.fecha_alta)}</td>

                <td className="p-3">
                  <div className