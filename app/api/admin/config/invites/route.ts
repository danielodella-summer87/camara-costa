import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABLE = "app_user_invites";
const ALLOWED_ROLES = ["admin", "operador", "comercial", "viewer"];

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

/**
 * POST /api/admin/config/invites
 * Crea una invitación (allowlist) por email + rol.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();

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

    const { data, error } = await supabase
      .from(TABLE)
      .insert({ email, role: roleValue })
      .select("id, email, role, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { data: null, error: "Ese email ya está invitado" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (e: unknown) {
    return NextResponse.json(
      { data: null, error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
