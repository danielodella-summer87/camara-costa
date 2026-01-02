"use server";

import { createClient } from "@supabase/supabase-js";

type CreateAccionInput = {
  socio_id: string;
  tipo: string;
  nota?: string | null;
  realizada_at?: string; // ISO (opcional)
};

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ✅ server-only

  if (!supabaseUrl) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function createSocioAccion(input: CreateAccionInput) {
  const supabase = supabaseAdmin();

  const payload = {
    socio_id: input.socio_id,
    tipo: input.tipo,
    nota: input.nota ?? null,
    realizada_at: input.realizada_at ?? new Date().toISOString(),
  };

  const { error } = await supabase.from("socio_acciones").insert(payload);
  if (error) throw new Error(`Supabase insert socio_acciones: ${error.message}`);
}

export async function deleteSocioAccion(id: string) {
  const supabase = supabaseAdmin();

  const { error } = await supabase.from("socio_acciones").delete().eq("id", id);
  if (error) throw new Error(`Supabase delete socio_acciones: ${error.message}`);
}