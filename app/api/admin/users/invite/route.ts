import { NextResponse } from "next/server";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getResend } from "@/lib/email/resend";
import { inviteEmailHtml, inviteEmailSubject } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

type Body = {
  email: string;
  nombre?: string;
  role_id: string;
  role_name?: string;
};

export async function POST(req: Request) {
  try {
    const currentUserId = await getInternalUserIdFromRequest();
    if (!currentUserId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;

    const email = body.email?.trim().toLowerCase();
    const nombre = body.nombre?.trim() || null;
    const role_id = body.role_id?.trim();
    const role_name = body.role_name?.trim();

    if (!email || !role_id) {
      return NextResponse.json(
        { error: "email y role_id son requeridos" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseServer
      .from("app_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      email,
      nombre: nombre ?? email,
      is_active: true,
      role_id,
      invite_status: "sent",
      invited_at: new Date().toISOString(),
    };

    let data: { id: string; email: string | null; nombre: string | null; role_id: string | null } | null;

    if (existing?.id) {
      const { data: updated, error } = await supabaseServer
        .from("app_users")
        .update(payload)
        .eq("id", existing.id)
        .select("id, email, nombre, role_id")
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      data = updated;
    } else {
      const { data: inserted, error } = await supabaseServer
        .from("app_users")
        .insert(payload)
        .select("id, email, nombre, role_id")
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      data = inserted;
    }

    const appUrl = process.env.APP_URL;
    const from = process.env.MAIL_FROM;
    if (!appUrl || !from) {
      return NextResponse.json(
        { error: "APP_URL o MAIL_FROM no configurados" },
        { status: 500 }
      );
    }

    const resend = getResend();
    await resend.emails.send({
      from,
      to: email,
      subject: inviteEmailSubject(),
      html: inviteEmailHtml({
        appUrl,
        email,
        roleName: role_name,
      }),
    });

    return NextResponse.json({ ok: true, user: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
