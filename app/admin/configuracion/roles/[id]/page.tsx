import { redirect } from "next/navigation";
import Link from "next/link";
import { getAppUserFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PermissionRow = {
  id: string;
  label: string | null;
  category: string | null;
};

export default async function RoleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const roleId = params.id;

  const appUser = await getAppUserFromRequest();
  if (!appUser) redirect(`/login?next=/admin/configuracion/roles/${roleId}`);

  const { data: role, error: roleErr } = await supabaseServer
    .from("roles")
    .select("id,name")
    .eq("id", roleId)
    .single();

  if (roleErr || !role) {
    return (
      <div className="border rounded-xl p-4 bg-white">
        <div className="font-semibold">Rol</div>
        <div className="text-sm text-red-600 mt-2">
          No se pudo cargar el rol.
        </div>
        <div className="mt-3">
          <Link className="border rounded-lg px-3 py-2 text-sm" href="/admin/configuracion/roles">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  const { data: permsData, error: permsErr } = await supabaseServer
    .from("permissions")
    .select("id,label,category")
    .order("id", { ascending: true });

  if (permsErr) {
    return (
      <div className="border rounded-xl p-4 bg-white">
        <div className="font-semibold">Permisos</div>
        <div className="text-sm text-red-600 mt-2">
          Error cargando permissions: {permsErr.message}
        </div>
      </div>
    );
  }

  const permissions: PermissionRow[] = permsData ?? [];

  const { data: rpData, error: rpErr } = await supabaseServer
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);

  if (rpErr) {
    return (
      <div className="border rounded-xl p-4 bg-white">
        <div className="font-semibold">Permisos del rol</div>
        <div className="text-sm text-red-600 mt-2">
          Error cargando role_permissions: {rpErr.message}
        </div>
      </div>
    );
  }

  const assigned = new Set<string>((rpData ?? []).map((x: any) => x.permission_id));

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Rol: {role.name}</div>
            <div className="text-sm text-gray-500">
              Activá/desactivá permisos (role_permissions).
            </div>
          </div>

          <Link className="border rounded-lg px-3 py-2 text-sm" href="/admin/configuracion/roles">
            Volver
          </Link>
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="p-3 border-b text-sm text-gray-600">
          Permisos totales: <span className="font-semibold">{permissions.length}</span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">ID</th>
              <th className="p-3">Label</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Activo</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => {
              const on = assigned.has(p.id);
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{p.id ?? "-"}</td>
                  <td className="p-3">{p.label ?? "-"}</td>
                  <td className="p-3 text-gray-600">{p.category ?? "-"}</td>
                  <td className="p-3">
                    <form action="/api/admin/roles/toggle-permission" method="POST">
                      <input type="hidden" name="role_id" value={roleId} />
                      <input type="hidden" name="permission_id" value={p.id} />
                      <input type="hidden" name="next_on" value={on ? "0" : "1"} />
                      <button
                        className={`border rounded-lg px-3 py-1 ${
                          on ? "bg-white" : "bg-gray-100 text-gray-600"
                        }`}
                        type="submit"
                      >
                        {on ? "Sí" : "No"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}

            {permissions.length === 0 ? (
              <tr>
                <td className="p-6 text-gray-500" colSpan={4}>
                  No hay registros en <code>permissions</code>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
