import { NextResponse } from "next/server";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";
import { getResend } from "@/lib/email/resend";
import { inviteEmailHtml, inviteEmailSubject } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

type Body = {
  email: string;
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
    const role_name = body.role_name?.trim();

    if (!email) {
      return NextResponse.json(
        { error: "email requerido" },
        { status: 400 }
      );
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

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
