import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const user_id = String(form.get("user_id") ?? "");

  if (!user_id) {
    return NextResponse.redirect(new URL("/admin/configuracion/usuarios", req.url));
  }

  const maybeClient = await createServerSupabase();
  const supabase: any = (maybeClient as any)?.supabase ?? maybeClient;

  // OJO: esto elimina solo tu fila de app_users (no borra Supabase Auth)
  await supabase.from("app_users").delete().eq("id", user_id);

  return NextResponse.redirect(new URL("/admin/configuracion/usuarios", req.url));
}
