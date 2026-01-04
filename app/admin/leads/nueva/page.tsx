import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Mantengo /admin/leads/nueva por compatibilidad,
// pero el path canonical es /admin/leads/nuevo.
export default function Page() {
  redirect("/admin/leads/nuevo");
}