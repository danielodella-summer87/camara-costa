import { redirect } from "next/navigation";
import Link from "next/link";
import { getAppUserFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RoleRow = {
  id: string;
  name: string;
  users_count: number;
  perms_count: number;
};

export default async function ConfigRolesPage() {
  const appUser = await getAppUserFromRequest();
  if (!appUser) redirect("/login?next=/admin/configuracion/roles");

  const { data: rolesData, error: rolesErr } = await supabaseServer
    .from("roles")
    .select("id,name")
    .order("name", { ascending: true });

  if (rolesErr) {
    return (
      <div className="border rounded-xl p-4 bg-white">
        <div className="font-semibold">Roles</div>
        <div className="text-sm text-red-600 mt-2">
          Error cargando roles: {rolesErr.message}
        </div>
      </div>
    );
  }

  const roles = rolesData ?? [];

  // counts (usuarios por rol)
  const { data: usersByRole } = await supabaseServer
    .from("app_users")
    .select("role_id", { count: "exact", head: false });

  // counts (permisos por rol)
  const { data: rpData } = await supabaseServer.from("role_permissions").select("role_id");

  const usersCountMap = new Map<string, number>();
  // Nota: PostgREST no devuelve agregaciones fácil sin RPC; hacemos fallback simple:
  // Si querés conteo exacto por rol, lo hacemos luego con una vista/RPC.
  // Por ahora: marcamos 0 y lo completamos con query por rol si lo pedís.

  const permsCountMap = new Map<string, number>();
  (rpData ?? []).forEach((x: any) => {
    const rid = x.role_id;
    permsCountMap.set(rid, (permsCountMap.get(rid) ?? 0) + 1);
  });

  const rows: RoleRow[] = roles.map((r: any) => ({
    id: r.id,
    name: r.name,
    users_count: usersCountMap.get(r.id) ?? 0,
    perms_count: permsCountMap.get(r.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Roles</div>
            <div className="text-sm text-gray-500">
              Entrá a un rol para ver/gestionar permisos (role_permissions).
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              className="border rounded-lg px-3 py-2 text-sm"
              href="/admin/configuracion"
            >
              Volver
            </Link>
            <Link
              className="border rounded-lg px-3 py-2 text-sm"
              href="/admin/configuracion/usuarios"
            >
              Ver Usuarios
            </Link>
          </div>
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="p-3 border-b text-sm text-gray-600">
          Total roles: <span className="font-semibold">{rows.length}</span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">Rol</th>
              <th className="p-3">Permisos</th>
              <th className="p-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3">{r.perms_count}</td>
                <td className="p-3">
                  <Link
                    className="border rounded-lg px-3 py-1 inline-block"
                    href={`/admin/configuracion/roles/${r.id}`}
                  >
                    Gestionar permisos
                  </Link>
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td className="p-6 text-gray-500" colSpan={3}>
                  No hay roles en <code>roles</code>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
