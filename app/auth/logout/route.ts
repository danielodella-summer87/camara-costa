import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const maybeClient = await createServerSupabase();
  const supabase = (maybeClient as any)?.supabase ?? (maybeClient as any);

  try {
    await supabase?.auth?.signOut?.();
  } catch {
    // ignore
  }

  // Redirigimos al login (el cliente igual hace push)
  const url = new URL(req.url);
  return NextResponse.redirect(new URL("/login", url.origin));
}
