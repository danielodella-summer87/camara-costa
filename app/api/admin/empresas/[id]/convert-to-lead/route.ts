import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function normalizeWebsite(url?: string | null) {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

export async function POST(
  req: Request,
  ctx: { params?: { id?: string } | Promise<{ id?: string }> }
) {
  try {
    const { requirePermission } = await import("@/lib/rbac/requirePermission");
    const user = await requirePermission(req as any, "leads.create");
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const params = ctx?.params ? await Promise.resolve(ctx.params as any) : undefined;
    const empresaId = params?.id;

    if (!empresaId || typeof empresaId !== "string") {
      return NextResponse.json({ error: "empresaId faltante o inválido en la URL" }, { status: 400 });
    }

    const sb = supabaseAdmin();

    // Validar "empresa existe"
    const { data: empresa, error: empErr } = await sb
      .from("empresas")
      .select("id,nombre,email,telefono,web,instagram,direccion,rubro_id")
      .eq("id", empresaId)
      .maybeSingle();

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });
    if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

    // Resolver comercial_id: usuario logueado (app_users.comercial_id o email) o fallbacks
    const { data: appUser } = await sb
      .from("app_users")
      .select("email, comercial_id")
      .eq("id", user.id)
      .maybeSingle();

    let comercialId: string | null = appUser?.comercial_id ?? null;

    if (!comercialId && appUser?.email) {
      const { data: byEmail } = await sb
        .from("comerciales")
        .select("id")
        .ilike("email", String(appUser.email).trim())
        .limit(1)
        .maybeSingle();
      comercialId = byEmail?.id ?? null;
    }

    if (!comercialId) {
      const { data: firstComercial } = await sb
        .from("comerciales")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      comercialId = firstComercial?.id ?? null;
    }

    if (!comercialId) {
      const { data: sinAsignar } = await sb
        .from("comerciales")
        .select("id")
        .eq("nombre", "Sin asignar")
        .maybeSingle();
      comercialId = sinAsignar?.id ?? null;
    }

    const DEFAULT_COMERCIAL_ID = "3ceafb59-8e5a-478c-b534-1dc6f9b22583";
    if (!comercialId) comercialId = DEFAULT_COMERCIAL_ID;

    // Siempre insert: nuevo lead con empresa_id y comercial_id
    const payload: Record<string, unknown> = {
      empresa_id: empresa.id,
      nombre: empresa.nombre,
      email: empresa.email ?? null,
      telefono: empresa.telefono ?? null,
      website: normalizeWebsite(empresa.web),
      notas: empresa.instagram ? `IG: ${empresa.instagram}` : null,
      origen: "Desde entidad",
      pipeline: "Nuevo",
      comercial_id: comercialId,
    };

    const { data: created, error: createErr } = await sb
      .from("leads")
      .insert(payload)
      .select("id")
      .single();

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

    return NextResponse.json({ data: { lead_id: created.id } });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
