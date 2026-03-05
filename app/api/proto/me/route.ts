import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessionCookieName, getSessionUser } from "@/lib/auth/internalAuth";

export async function GET() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(getSessionCookieName())?.value ?? null;
  const session = await getSessionUser(cookieValue, supabaseServer);

  if (process.env.NODE_ENV !== "production") {
    console.log("[PROTO_ME_INTERNAL]", {
      cookiePresent: Boolean(cookieValue),
      userId: session?.userId ?? null,
    });
  }

  if (!session) {
    return NextResponse.json(
      { ok: false, authed: false, session: null },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      authed: true,
      session: { id: session.userId },
    },
    { status: 200 }
  );
}
