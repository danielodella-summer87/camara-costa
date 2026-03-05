// src/app/actions/auth.ts
"use server";

import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { getDashboardPath, isValidRole, setSessionCookie, clearSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // Service Role SOLO en servidor
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function loginWithCedula(formData: FormData) {
  const cedulaRaw = String(formData.get("cedula") ?? "").trim();
  const pinRaw = String(formData.get("pin") ?? "").trim();

  if (!cedulaRaw) return { ok: false, error: "Ingresá tu cédula." };
  if (!pinRaw) return { ok: false, error: "Ingresá tu PIN." };
  if (!/^\d{4}$/.test(pinRaw)) return { ok: false, error: "El PIN debe tener 4 dígitos." };

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, cedula, full_name, pin_hash, role")
    .eq("cedula", cedulaRaw)
    .maybeSingle();

  if (error) return { ok: false, error: "Error consultando usuario." };
  if (!profile) return { ok: false, error: "Usuario no encontrado." };

  const match = await bcrypt.compare(pinRaw, profile.pin_hash);
  if (!match) return { ok: false, error: "PIN incorrecto." };

  if (!isValidRole(profile.role)) return { ok: false, error: "Rol inválido." };

  await setSessionCookie({ id: profile.id, role: profile.role });

  return { ok: true, redirectTo: getDashboardPath(profile.role) };
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

// Helper opcional para alta simple (solo si lo necesitás desde UI admin)
// OJO: proteger esto por permiso/rol si lo exponés.
export async function createProfile({
  cedula,
  full_name,
  pin,
  role = "member",
  chamber_id,
}: {
  cedula: string;
  full_name: string;
  pin: string;
  role?: "superadmin" | "admin" | "staff" | "member";
  chamber_id?: string | null;
}) {
  if (!cedula?.trim()) return { ok: false, error: "Cédula requerida." };
  if (!full_name?.trim()) return { ok: false, error: "Nombre requerido." };
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "PIN debe ser 4 dígitos." };
  if (!isValidRole(role)) return { ok: false, error: "Rol inválido." };

  const pin_hash = await bcrypt.hash(pin, 10);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .insert({
      cedula: cedula.trim(),
      full_name: full_name.trim(),
      pin_hash,
      role,
      chamber_id: chamber_id ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: "No se pudo crear el usuario." };
  return { ok: true, id: data.id };
}
