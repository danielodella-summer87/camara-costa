import { NextRequest, NextResponse } from "next/server";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const TABLE = "app_user_invites";
const ALLOWED_ROLES = ["admin", "operador", "comercial", "viewer"];

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

/** Resuelve role key a role_id (UUID) con cliente admin. */
async function resolveRoleId(admin: SupabaseClient, roleKey: string): Promise<string | null> {
  const key = roleKey.trim().toLowerCase();
  const name = key === "operador" ? "operaciones" : key;
  const r = await admin.from("roles").select("id").ilike("name", name).maybeSingle();
  const data = r.data as { id?: string } | null;
  if (data?.id) return data.id;
  const r2 = await admin.from("roles").select("id").ilike("name", "viewer").maybeSingle();
  const d = r2.data as { id?: string } | null;
  if (d?.id) return d.id;
  const r3 = await admin.from("roles").select("id").ilike("name", "solo_lectura").maybeSingle();
  const d2 = r3.data as { id?: string } | null;
  return d2?.id ?? null;
}

/**
 * POST /api/admin/config/invites
 * Crea una invitación (allowlist) por email + rol y asegura fila en app_users.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getInternalUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    let email: string | null = null;
    let role: string | null = null;

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      email = norm(body?.email) || null;
      role = norm(body?.role) || null;
    } else {
      const formData = await req.formData().catch(() => null);
      if (formData) {
        email = norm(formData.get("email") as string) || null;
        role = norm(formData.get("role") as string) || null;
      }
    }

    if (!email) {
      return NextResponse.json(
        { data: null, error: "Falta email" },
        { status: 400 }
      );
    }

    const roleValue = role && ALLOWED_ROLES.includes(role) ? role : "viewer";

    const { data, error } = await supabaseServer
      .from(TABLE)
      .insert({ email, role: roleValue })
      .select("id, email, role, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { ok: false, error: "Ese email ya está invitado", code: "already_invited" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 400 }
      );
    }

    const roleId = await resolveRoleId(supabaseServer, roleValue);
    if (roleId) {
      const { data: existing } = await supabaseServer.from("app_users").select("id").eq("email", email).maybeSingle();
      if (existing) {
        await supabaseServer.from("app_users").update({ is_active: true, role_id: roleId, nombre: email }).eq("id", existing.id);
      } else {
        await supabaseServer.from("app_users").insert({ email, nombre: email, is_active: true, role_id: roleId });
      }
    }

    return NextResponse.json({ data, error: null });
  } catch (e: unknown) {
    return NextResponse.json(
      { data: null, error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
