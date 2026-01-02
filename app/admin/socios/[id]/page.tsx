import EditSocioForm from "./EditSocioForm";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function SocioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: socio, error } = await supabaseServer
    .from("socios")
    .select("id, nombre, plan, estado, fecha_alta, email, telefono, notas")
    .eq("id", id)
    .single();

  if (error || !socio) return notFound();

  return (
    <div className="max-w-[1200px]">
      <h1 className="text-2xl font-semibold text-slate-900">{socio.nombre}</h1>
      <p className="text-slate-600">ID: {socio.id}</p>
      <EditSocioForm
  id={socio.id}
  initialPlan={socio.plan}
  initialEstado={socio.estado}
/>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">Plan</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{socio.plan}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">Fecha de alta</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">
            {socio.fecha_alta}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">Contacto</div>
          <div className="mt-1 text-slate-900">{socio.email || "-"}</div>
          <div className="text-slate-900">{socio.telefono || "-"}</div>
        </div>

        <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">Notas</div>
          <div className="mt-2 text-slate-900">{socio.notas || "-"}</div>
        </div>
      </div>
    </div>
  );
}