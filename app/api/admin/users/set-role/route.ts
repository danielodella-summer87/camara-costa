import { NextResponse } from "next/server";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const currentUserId = await getInternalUserIdFromRequest();
  if (!currentUserId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const form = await req.formData();
  const user_id = String(form.get("user_id") ?? "");
  const role_id = String(form.get("role_id") ?? "");

  if (!user_id || !role_id) {
    return NextResponse.redirect(new URL("/admin/configuracion/usuarios", req.url));
  }

  await supabaseServer.from("app_users").update({ role_id }).eq("id", user_id);

  return NextResponse.redirect(new URL("/admin/configuracion/usuarios", req.url));
}
