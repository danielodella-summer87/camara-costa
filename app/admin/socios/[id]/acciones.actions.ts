"use server";

import { createClient } from "@supabase/supabase-js";

type CreateAccionInput = {
  socio_id: string;
  tipo: string;
  nota?: string | null;
  realizada_at?: string; // ISO (opcional)
};

function supabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

export async function createSocioAccion(input: CreateAccionInput) {
  const supabase = supabaseServer();

  const payload = {
    socio_id: input.socio_id,
    tipo: input.tipo,
    nota: input.nota ?? null,
    realizada_at: input.realizada_at ?? new Date().toISOString(),
  };

  const { error } = await supabase.from("socio_acciones").insert(payload);

  if (error) throw new Error(error.message);
}

export async function deleteSocioAccion(id: string) {
  const supabase = supabaseServer();
  const { error } = await supabase.from("socio_acciones").delete().eq("id", id);
  if (error) throw new Error(error.message);
}