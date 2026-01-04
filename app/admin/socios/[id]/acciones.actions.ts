"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

type CreateAccionInput = {
  socio_id: string;
  tipo: string;
  nota?: string | null;
  realizada_at?: string; // ISO (opcional)
};

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function createSocioAccion(input: CreateAccionInput) {
  const supabase = supabaseAdmin();

  const payload = {
    socio_id: input.socio_id,
    tipo: input.tipo,
    // nota NO puede ser null (DB NOT NULL) -> mandamos string vacío si viene vacío/null
    nota: (input.nota ?? "").toString(),
    realizada_at: input.realizada_at ?? new Date().toISOString(),
  };

  const { error } = await supabase.from("socio_acciones").insert(payload);

  if (error) throw new Error(error.message);

  // refresca la página del socio + lista (por si hay widgets/contadores)
  revalidatePath(`/admin/socios/${input.socio_id}`);
  revalidatePath(`/admin/socios`);
}

export async function deleteSocioAccion(id: string, socioId?: string) {
  const supabase = supabaseAdmin();

  const { error } = await supabase.from("socio_acciones").delete().eq("id", id);

  if (error) throw new Error(error.message);

  if (socioId) {
    revalidatePath(`/admin/socios/${socioId}`);
  }
  revalidatePath(`/admin/socios`);
}