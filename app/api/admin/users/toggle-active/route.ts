import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const user_id = String(form.get("user_id") ?? "");
  const next_active = String(form.get("next_active") ?? "1") === "1";

  if (!user_id) {
    return NextResponse.redirect(new URL("/admin/configuracion/usuarios", req.url));
  }

  const maybeClient = await createServerSupabase();
  const supabase: any = (maybeClient as any)?.supabase ?? maybeClient;

  await supabase.from("app_users").update({ is_active: next_active }).eq("id", user_id);

  return NextResponse.redirect(new URL("/admin/configuracion/usuarios", req.url));
}
