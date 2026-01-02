import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import EditSocioForm from "./EditSocioForm";

type Params = { id: string };

export default async function SocioDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  // ✅ Traemos el socio desde la VIEW (ya viene `alta`, `semaforo`, `proxima_accion`)
  const { data: socio, error: socioError } = await supabase
    .from("v_socio_inteligente")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (socioError || !socio) {
    return (
      <div className="p-10">
        <Link
          href="/admin/socios"
          className="text-sm text-slate-600 hover:underline"
        >
          ← Volver a socios
        </Link>

        <div className="mt-6 rounded-xl border bg-white p-6">
          <div className="font-semibold text-red-600">
            No pude cargar el socio.
          </div>
          <div className="mt-2 text-sm text-slate-600">
            {socioError?.message ?? "No se encontró el socio."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10">
      <Link
        href="/admin/socios"
        className="text-sm text-slate-600 hover:underline"
      >
        ← Volver a socios
      </Link>

      <div className="mt-6 rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{socio.nombre}</h1>

          <div className="text-sm text-slate-600">
            ID: <span className="font-mono">{socio.id}</span> · Plan:{" "}
            {socio.plan ?? "—"} · Estado: {socio.estado ?? "—"}
          </div>

          <div className="text-sm text-slate-600">
            Alta: {socio.alta ?? "—"} · Semáforo: {socio.semaforo ?? "—"} ·
            Próxima acción: {socio.proxima_accion ?? "—"}
          </div>
        </div>

        <div className="mt-6">
          {/* ✅ CLAVE: props simples + key por socio para evitar estado “pegado” */}
          <EditSocioForm
            key={socio.id}
            id={socio.id}
            initialPlan={socio.plan ?? ""}
            initialEstado={socio.estado ?? ""}
          />
        </div>
      </div>
    </div>
  );
}