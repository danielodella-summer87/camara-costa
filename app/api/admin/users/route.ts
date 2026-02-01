// app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ApiResp<T> = { data: T | null; error: string | null };

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    // ✅ Permitir a cualquier usuario autenticado con permiso base (ej: comercial)
    const { requirePermission } = await import("@/lib/rbac/requirePermission");
    const user = await requirePermission(req, "leads.read");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const sb = supabaseAdmin();
    if (!sb) {
      return NextResponse.json(
        { data: null, error: "Supabase admin no configurado" } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Usuarios activos del CRM (app_users)
    const { data, error } = await sb
      .from("app_users")
      .select("id,nombre,email,is_active,role_id,roles:role_id(name),created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message } satisfies ApiResp<null>,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Normalizar role como string (roles.name) si viene
    const rows =
      (data ?? []).map((u: any) => {
        const rel = u.roles;
        const roleName =
          rel == null ? null : Array.isArray(rel) ? rel[0]?.name ?? null : rel?.name ?? null;

        return {
          id: u.id,
          nombre: u.nombre ?? null,
          email: u.email ?? null,
          role_id: u.role_id ?? null,
          role: roleName,
        };
      });

    return NextResponse.json(
      { data: rows, error: null } satisfies ApiResp<typeof rows>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
