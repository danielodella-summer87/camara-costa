import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

export async function GET(_req: NextRequest) {
  try {
    const sb = supabaseAdmin();
    const cookieStore = await cookies();
    const userId = cookieStore.get("x-user-id")?.value ?? null;

    if (!userId) {
      return NextResponse.json({ data: { user: null }, error: null } satisfies ApiResp<any>, { status: 200 });
    }

    const { data: user, error } = await sb
      .from("app_users")
      .select("id,nombre,email,is_active,role_id,roles:role_id(id,name,label)")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ data: { user: user ?? null }, error: null } satisfies ApiResp<any>, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}