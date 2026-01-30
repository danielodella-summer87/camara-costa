import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

/**
 * Helper: permite acceso en desarrollo, requiere permiso en producción
 */
async function allowDevOrRequire(req: NextRequest, perm: string) {
  if (process.env.NODE_ENV !== "production") return { id: "dev" };
  return await requirePermission(req, perm);
}

/**
 * GET /api/admin/config/roles
 * Lista todos los roles con sus permisos
 */
export async function GET(req: NextRequest) {
  try {
    // Requerir permiso de lectura de configuración
    const user = await allowDevOrRequire(req, "config.read");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    const sb = supabaseAdmin();

    // Obtener roles
    const { data: roles, error: rolesError } = await sb
      .from("roles")
      .select("id, name, label, description, is_system, created_at, updated_at")
      .order("name");

    if (rolesError) throw rolesError;

    // Obtener permisos
    const { data: permissions, error: permsError } = await sb
      .from("permissions")
      .select("id, key, module, action, description")
      .order("module, action");

    if (permsError) throw permsError;

    // Obtener asignaciones role_permissions
    const { data: rolePerms, error: rolePermsError } = await sb
      .from("role_permissions")
      .select("role_id, permission_id");

    if (rolePermsError) throw rolePermsError;

    // Construir respuesta con permisos por rol
    const rolesWithPerms = (roles || []).map((role) => {
      const rolePermissionIds = (rolePerms || [])
        .filter((rp) => rp.role_id === role.id)
        .map((rp) => rp.permission_id);

      const rolePermissions = (permissions || []).filter((p) =>
        rolePermissionIds.includes(p.id)
      );

      return {
        ...role,
        permissions: rolePermissions,
      };
    });

    return NextResponse.json(
      {
        data: {
          roles: rolesWithPerms,
          allPermissions: permissions || [],
        },
        error: null,
      } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/config/roles
 * Crea un nuevo rol
 */
export async function POST(req: NextRequest) {
  try {
    // Requerir permiso de administración de configuración
    const user = await allowDevOrRequire(req, "config.admin");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { data: null, error: "Body inválido" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const { name, label, description } = body;
    if (!name || !label || typeof name !== "string" || typeof label !== "string") {
      return NextResponse.json(
        { data: null, error: "name y label son requeridos" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("roles")
      .insert({
        name: name.trim(),
        label: label.trim(),
        description: description?.trim() || null,
        is_system: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { data, error: null } satisfies ApiResp<any>,
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/config/roles
 * Actualiza permisos de un rol
 */
export async function PATCH(req: NextRequest) {
  try {
    // Requerir permiso de administración de configuración
    const user = await allowDevOrRequire(req, "config.admin");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { data: null, error: "Body inválido" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const { roleId, permissionIds } = body;
    if (!roleId || !Array.isArray(permissionIds)) {
      return NextResponse.json(
        { data: null, error: "roleId y permissionIds (array) son requeridos" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();

    // Verificar que el rol existe y no es del sistema (o permitir actualizar permisos de roles del sistema)
    const { data: role, error: roleError } = await sb
      .from("roles")
      .select("id, is_system")
      .eq("id", roleId)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { data: null, error: "Rol no encontrado" } satisfies ApiResp<null>,
        { status: 404 }
      );
    }

    // Eliminar todos los permisos actuales del rol
    const { error: deleteError } = await sb
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (deleteError) throw deleteError;

    // Insertar nuevos permisos
    if (permissionIds.length > 0) {
      const rolePermsToInsert = permissionIds.map((permId: string) => ({
        role_id: roleId,
        permission_id: permId,
      }));

      const { error: insertError } = await sb
        .from("role_permissions")
        .insert(rolePermsToInsert);

      if (insertError) throw insertError;
    }

    return NextResponse.json(
      { data: { success: true }, error: null } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
