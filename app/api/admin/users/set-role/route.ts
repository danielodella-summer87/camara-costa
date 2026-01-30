import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const user_id = String(form.get("user_id") ?? "");
  const role_id = String(form.get("role_id") ?? "");

  if (!user_id || !role_id) {
    return NextResponse.redirect(new URL("/admin/configuracion/usuarios", req.url));
  }

  const maybeClient = await createServerSupabase();
  const supabase: any = (maybeClient as any)?.supabase ?? maybeClient;

  await supabase.from("app_users").update({ role_id }).eq("id", user_id);

  return NextResponse.redirect(new URL("/admin/configuracion/usuarios", req.url));
}
