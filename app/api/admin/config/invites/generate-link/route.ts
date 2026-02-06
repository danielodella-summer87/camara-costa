import { NextResponse } from "next/server";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}`.replace(/\/$/, "") : "") ||
  "http://localhost:3000";

const DEFAULT_ROLE_KEYS = ["viewer", "solo_lectura"];

/** Resuelve role_id (UUID) desde body: role_id (UUID) o role (key). */
async function resolveRoleId(admin: SupabaseClient, body: { role_id?: string; role?: string }): Promise<string | null> {
  const roleId = String(body?.role_id ?? "").trim();
  if (roleId && /^[0-9a-f-]{36}$/i.test(roleId)) {
    const r = await admin.from("roles").select("id").eq("id", roleId).maybeSingle();
    const data = r.data as { id?: string } | null;
    if (data?.id) return data.id;
  }

  const roleKey = String(body?.role ?? "").trim().toLowerCase();
  if (roleKey) {
    const r = await admin.from("roles").select("id").ilike("name", roleKey).maybeSingle();
    const data = r.data as { id?: string } | null;
    if (data?.id) return data.id;
    const alias = roleKey === "operador" ? "operaciones" : roleKey;
    const r2 = await admin.from("roles").select("id").ilike("name", alias).maybeSingle();
    const d = r2.data as { id?: string } | null;
    if (d?.id) return d.id;
  }

  for (const key of DEFAULT_ROLE_KEYS) {
    const r = await admin.from("roles").select("id").ilike("name", key).maybeSingle();
    const data = r.data as { id?: string } | null;
    if (data?.id) return data.id;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const userId = await getInternalUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email requerido" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Configuración de servidor incompleta" },
        { status: 500 }
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${SITE_URL}/auth/callback`,
      },
    });

    if (error) {
      const msg = error.message || "";
      const isAlready = /already registered/i.test(msg) || /already invited/i.test(msg) || /ya está invitado/i.test(msg) || /user already exists/i.test(msg);
      if (isAlready) {
        return NextResponse.json(
          { ok: false, error: "Usuario ya existe o ya fue invitado." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { ok: false, error: msg || "Error generando link" },
        { status: 500 }
      );
    }

    const link = data?.properties?.action_link;
    if (!link) {
      return NextResponse.json(
        { ok: false, error: "No se pudo obtener el link de invitación" },
        { status: 500 }
      );
    }

    const roleId = await resolveRoleId(admin, body);
    if (!roleId) {
      return NextResponse.json(
        { ok: false, error: "No se pudo resolver el rol (viewer por defecto)" },
        { status: 500 }
      );
    }

    const nombre = email || "";

    const { data: existing } = await admin
      .from("app_users")
      .select("id, auth_user_id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await admin
        .from("app_users")
        .update({ is_active: true, role_id: roleId, nombre })
        .eq("id", existing.id);
      if (updErr) {
        return NextResponse.json(
          { ok: false, error: "Error actualizando app_users: " + updErr.message },
          { status: 500 }
        );
      }
    } else {
      const { error: insErr } = await admin.from("app_users").insert({
        email,
        nombre,
        is_active: true,
        role_id: roleId,
      });
      if (insErr) {
        return NextResponse.json(
          { ok: false, error: "Error creando app_users: " + insErr.message },
          { status: 500 }
        );
      }
    }

    console.log("[INVITE LINK]", email, link);

    return NextResponse.json({ ok: true, link }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
