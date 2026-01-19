import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import EditSocioForm from "./EditSocioForm";
import SocioAcciones from "./SocioAcciones";

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  // Socio con join a empresas
  const { data: socio, error: socioError } = await supabase
    .from("socios")
    .select("id, plan, estado, fecha_alta, proxima_accion, empresa_id, empresas:empresa_id(id,nombre,email,telefono,web,direccion)")
    .eq("id", id)
    .maybeSingle();

  if (socioError || !socio) {
    return (
      <div className="p-10">
        <Link href="/admin/socios" className="text-sm text-slate-600 hover:underline">
          ← Volver a socios
        </Link>

        <div className="mt-6 rounded-xl border bg-white p-6">
          <div className="text-red-600 font-semibold">No pude cargar el socio.</div>
          <div className="text-sm text-slate-600 mt-2">
            {socioError?.message ?? "No se encontró el socio."}
          </div>
        </div>
      </div>
    );
  }

  // Acciones (últimas 25)
  const { data: accionesRows } = await supabase
    .from("socio_acciones")
    .select("id,socio_id,tipo,nota,realizada_at")
    .eq("socio_id", id)
    .order("realizada_at", { ascending: false })
    .limit(25);

  const acciones: Accion[] = Array.isArray(accionesRows) ? (accionesRows as any) : [];

  return (
    <div className="p-10">
      <Link href="/admin/socios" className="text-sm text-slate-600 hover:underline">
        ← Volver a socios
      </Link>

      <div className="mt-6 rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{(socio.empresas as any)?.nombre ?? "—"}</h1>

          <div className="text-sm text-slate-600">
            ID: <span className="font-mono">{socio.id}</span> · Plan: {socio.plan ?? "—"} · Estado: {socio.estado ?? "—"}
          </div>

          <div className="text-sm text-slate-600">
            Alta: {socio.fecha_alta ?? "—"} · Próxima acción: {socio.proxima_accion ?? "—"}
          </div>

          {/* Datos de la empresa */}
          {(socio.empresas as any) && (
            <div className="mt-4 rounded-xl border bg-slate-50 p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Datos de la empresa</h2>
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

        {/* Acciones */}
        <SocioAcciones socioId={socio.id} />
      </div>
    </div>
  );
}