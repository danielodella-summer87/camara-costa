import { redirect } from "next/navigation";
import { getActiveUserPermissions } from "@/lib/rbac/server";

/**
 * Layout de /admin/configuracion y todas sus rutas hijas.
 * Bloquea acceso server-side si el usuario no tiene permiso "config.admin":
 * redirige a /admin sin renderizar contenido (no responde 200 con la página).
 */
export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const permissions = await getActiveUserPermissions();

  if (!permissions.includes("config.admin")) {
    redirect("/admin");
  }

  return <>{children}</>;
}
