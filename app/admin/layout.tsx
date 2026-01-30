import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "./AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // createServerSupabase puede devolver:
  // 1) el cliente directamente
  // 2) un objeto { supabase: client }
  const maybeClient = await createServerSupabase();
  const supabase =
    (maybeClient as any)?.supabase ?? (maybeClient as any);

  if (!supabase?.auth?.getUser) {
    // si no hay cliente válido, mandamos a login en vez de romper
    redirect("/login?next=/admin");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login?next=/admin");
  }

  return <AdminShell>{children}</AdminShell>;
}
