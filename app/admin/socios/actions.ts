"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

/* =========================
   SOCIOS
========================= */

export async function updateSocio(input: {
  id: string;
  plan?: string;
  estado?: string;
}) {
  const { id, plan, estado } = input;

  const payload: Record<string, string> = {};
  if (plan !== undefined) payload.plan = plan;
  if (estado !== undefined) payload.estado = estado;

  const { error } = await supabaseServer
    .from("socios")
    .update(payload)
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/socios/${id}`);
  revalidatePath(`/admin/socios`);
}

/* =========================
   ACCIONES COMERCIALES
========================= */

export type SocioAccionTipo =
  | "Email"
  | "Reunión"
  | "WhatsApp"
  | "Visita"
  | "Llamada"
  | "Otro";

export async function createSocioAccion(input: {
  socio_id: string;
  tipo: SocioAccionTipo;
  nota: string;
}) {
  const { socio_id, tipo, nota } = input;

  if (!nota?.trim()) {
    throw new Error("La nota es obligatoria.");
  }

  const { error } = await supabaseServer.from("socio_acciones").insert({
    socio_id,
    tipo,
    nota: nota.trim(),
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/socios/${socio_id}`);
}

export async function deleteSocioAccion(input: {
  id: string;
  socio_id: string;
}) {
  const { id, socio_id } = input;

  const { error } = await supabaseServer
    .from("socio_acciones")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/socios/${socio_id}`);
}