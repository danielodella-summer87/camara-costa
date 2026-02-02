import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getServerLabels } from "@/lib/labels/server";
import EditSocioForm from "./EditSocioForm";
import SocioAcciones from "./SocioAcciones";
import DeleteSocioButton from "./DeleteSocioButton";

type Params = { id: string };

type Accion = {
  id: string;
  socio_id: string;
  tipo: string;
  nota: string | null;
  realizada_at: string;
};

export default async function SocioDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const labels = await getServerLabels();

  // Socio con join a empresas
  const { data: socio, error: socioError } = await supabaseServer
    .from("socios")
    .select("id, codigo, plan, estado, fecha_alta, proxima_accion, empresa_id, empresas:empresa_id(id,nombre,email,telefono,web,direccion)")
    .eq("id", id)
    .maybeSingle();

  if (socioError || !socio) {
    return (
      <div className="p-10">
        <Link href="/admin/socios" className="text-sm text-slate-600 hover:underline">
          ← Volver
        </Link>

        <div className="mt-6 rounded-xl border bg-white p-6">
          <div className="text-red-600 font-semibold">{`No pude cargar el ${labels.memberSingular.toLowerCase()}.`}</div>
          <div className="text-sm text-slate-600 mt-2">
            {socioError?.message ?? `No se encontró el ${labels.memberSingular.toLowerCase()}.`}
          </div>
        </div>
      </div>
    );
  }

  // Leads de este cliente (socio_id = id)
  const { data: leadsRows } = await supabaseServer
    .from("leads")
    .select("id, nombre, email, telefono, estado, pipeline, is_member, member_since, created_at")
    .eq("socio_id", id)
    .order("created_at", { ascending: false });

  const leadsDelCliente = Array.isArray(leadsRows) ? leadsRows : [];

  // Acciones (últimas 25)
  const { data: accionesRows } = await supabaseServer
    .from("socio_acciones")
    .select("id,socio_id,tipo,nota,realizada_at")
    .eq("socio_id", id)
    .order("realizada_at", { ascending: false })
    .limit(25);

  const acciones: Accion[] = Array.isArray(accionesRows) ? (accionesRows as any) : [];

  return (
    <div className="p-10">
      <Link href="/admin/socios" className="text-sm text-slate-600 hover:underline">
        ← Volver
      </Link>

      <div className="mt-6 rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{(socio.empresas as any)?.nombre ?? "—"}</h1>

          <div className="text-sm text-slate-600">
            Código: <span className="font-mono">{socio.codigo ?? "—"}</span> · ID: <span className="font-mono">{socio.id}</span> · Plan: {socio.plan ?? "—"} · Estado: {socio.estado ?? "—"}
          </div>

          <div className="text-sm text-slate-600">
            Alta: {socio.fecha_alta ?? "—"} · Próxima acción: {socio.proxima_accion ?? "—"}
          </div>

          {/* Leads de este cliente */}
          {leadsDelCliente.length > 0 && (
            <div className="mt-4 rounded-xl border bg-slate-50 p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Leads de este cliente</h2>
              <ul className="divide-y divide-slate-200 text-sm">
                {leadsDelCliente.map((lead: { id: string; nombre?: string | null; email?: string | null; estado?: string | null; pipeline?: string | null; is_member?: boolean | null }) => (
                  <li key={lead.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <Link href={`/admin/leads/${lead.id}`} className="font-medium text-blue-600 hover:underline">
                        {lead.nombre ?? "—"}
                      </Link>
                      {lead.email && <span className="text-slate-600 ml-2">{lead.email}</span>}
                      <span className="text-slate-500 ml-2">
                        {lead.estado ?? "—"} · {lead.pipeline ?? "—"}
                        {lead.is_member ? ` · ${labels.memberSingular}` : ""}
                      </span>
                    </div>
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Ver →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Datos de la empresa */}
          {(socio.empresas as any) && (
            <div className="mt-4 rounded-xl border bg-slate-50 p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Datos de la entidad</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
                {(socio.empresas as any).email && (
                  <div>
                    <span className="font-medium">Email:</span> {(socio.empresas as any).email}
                  </div>
                )}
                {(socio.empresas as any).telefono && (
                  <div>
                    <span className="font-medium">Teléfono:</span> {(socio.empresas as any).telefono}
                  </div>
                )}
                {(socio.empresas as any).web && (
                  <div>
                    <span className="font-medium">Web:</span>{" "}
                    <a
                      href={(socio.empresas as any).web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {(socio.empresas as any).web}
                    </a>
                  </div>
                )}
                {(socio.empresas as any).direccion && (
                  <div>
                    <span className="font-medium">Dirección:</span> {(socio.empresas as any).direccion}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Edición rápida */}
        <EditSocioForm id={socio.id} initialPlan={socio.plan} initialEstado={socio.estado} />

        {/* Botón eliminar */}
        <div className="mt-6">
          <DeleteSocioButton socioId={socio.id} />
        </div>

        {/* Acciones */}
        <SocioAcciones socioId={socio.id} />
      </div>
    </div>
  );
}