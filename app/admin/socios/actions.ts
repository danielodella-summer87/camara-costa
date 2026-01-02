"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function updateSocio(input: {
  id: string;
  plan?: string;
  estado?: string;
}) {
  const { id, plan, estado } = input;

  const payload: Record<string, string> = {};
  if (plan) payload.plan = plan;
  if (estado) payload.estado = estado;

  const { error } = await supabaseServer
    .from("socios")
    .update(payload)
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/socios/${id}`);
  revalidatePath(`/admin/socios`);
}