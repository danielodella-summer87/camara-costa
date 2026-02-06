import { NextResponse } from "next/server";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const currentUserId = await getInternalUserIdFromRequest();
  if (!currentUserId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const form = await req.formData();
  const role_id = String(form.get("role_id") ?? "");
  const permission_id = String(form.get("permission_id") ?? "");
  const next_on = String(form.get("next_on") ?? "0") === "1";

  if (!role_id || !permission_id) {
    return NextResponse.redirect(new URL("/admin/configuracion/roles", req.url));
  }

  if (next_on) {
    await supabaseServer.from("role_permissions").insert({ role_id, permission_id });
  } else {
    await supabaseServer
      .from("role_permissions")
      .delete()
      .eq("role_id", role_id)
      .eq("permission_id", permission_id);
  }

  return NextResponse.redirect(
    new URL(`/admin/configuracion/roles/${role_id}`, req.url)
  );
}
