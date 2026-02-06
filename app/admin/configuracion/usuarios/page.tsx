import { redirect } from "next/navigation";
import Link from "next/link";
import { getAppUserFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";

type RoleRow = { id: string; name: string };
type UserRow = {
  id: string;
  nombre: string | null;
  email: string | null;
  is_active: boolean | null;
  role_id: string | null;
  role_name: string | null;
};

export default async function ConfigUsuariosPage() {
  const appUser = await getAppUserFromRequest();
  if (!appUser) redirect("/login?next=/admin/configuracion/usuarios");

  // Roles
  const { data: rolesData, error: rolesErr } = await supabaseServer
    .from("roles")
    .select("id,name")
    .order("name", { ascending: true });

  if (rolesErr) {
    return (
      <div className="border rounded-xl p-4 bg-white">
        <div className="font-semibold">Usuarios</div>
        <div className="text-sm text-red-600 mt-2">
          Error cargando roles: {rolesErr.message}
        </div>
      </div>
    );
  }

  const roles: RoleRow[] =
    (rolesData ?? []).map((r: any) => ({ id: r.id, name: r.name })) ?? [];

  // Usuarios (tu tabla app_users)
  const { data: usersData, error: usersErr } = await supabaseServer
    .from("app_users")
    .select(
      `
        id,
        nombre,
        email,
        is_active,
        role_id,
        roles:role_id ( id, name )
      `
    )
    .order("nombre", { ascending: true });

  if (usersErr) {
    return (
      <div className="border rounded-xl p-4 bg-white">
        <div className="font-semibold">Usuarios</div>
        <div className="text-sm text-red-600 mt-2">
          Error cargando usuarios: {usersErr.message}
        </div>
      </div>
    );
  }

  const rows: UserRow[] =
    (usersData ?? []).map((u: any) => ({
      id: u.id,
      nombre: u.nombre ?? null,
      email: u.email ?? null,
      is_active: u.is_active ?? true,
      role_id: u.role_id ?? null,
      role_name: u.roles?.name ?? null,
    })) ?? [];

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Usuarios</div>
            <div className="text-sm text-gray-500">
              Gestión de usuarios del CRM: rol + estado activo.
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
              href="/admin/configuracion/roles"
            >
              Ver Roles
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Invitar usuario (allowlist)</div>
          <InviteForm />
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="p-3 border-b text-sm text-gray-600">
          Total: <span className="font-semibold">{rows.length}</span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">Nombre</th>
              <th className="p-3">Email</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Activo</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.nombre ?? "-"}</td>
                <td className="p-3">{u.email ?? "-"}</td>

                <td className="p-3">
                  <form action="/api/admin/users/set-role" method="POST" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="user_id" value={u.id} />
                    <select
                      name="role_id"
                      defaultValue={u.role_id ?? ""}
                      className="border rounded-lg px-2 py-1"
                    >
                      <option value="" disabled>
                        Seleccionar rol…
                      </option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="border rounded-lg px-3 py-1 text-sm">
                      Actualizar
                    </button>
                  </form>

                  <div className="text-xs text-gray-500 mt-1">
                    Actual: {u.role_name ?? "—"}
                  </div>
                </td>

                <td className="p-3">
                  <form action="/api/admin/users/toggle-active" method="POST">
                    <input type="hidden" name="user_id" value={u.id} />
                    <input
                      type="hidden"
                      name="next_active"
                      value={u.is_active ? "0" : "1"}
                    />
                    <button
                      className={`border rounded-lg px-3 py-1 ${
                        u.is_active
                          ? "bg-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                      type="submit"
                    >
                      {u.is_active ? "Sí" : "No"}
                    </button>
                  </form>
                </td>

                <td className="p-3">
                  <form action="/api/admin/users/delete" method="POST">
                    <input type="hidden" name="user_id" value={u.id} />
                    <button
                      className="border rounded-lg px-3 py-1 text-red-600"
                      type="submit"
                    >
                      Eliminar (app)
                    </button>
                  </form>
                  <div className="text-xs text-gray-500 mt-1">
                    (No borra Auth)
                  </div>
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td className="p-6 text-gray-500" colSpan={5}>
                  No hay usuarios en <code>app_users</code>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
