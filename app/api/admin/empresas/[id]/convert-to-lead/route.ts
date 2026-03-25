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

function trimStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function isMissingColumnError(message: string | undefined, table: string, column: string): boolean {
  const msg = (message ?? "").toLowerCase();
  return msg.includes(`could not find the '${column.toLowerCase()}' column of '${table.toLowerCase()}'`);
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
      .select(
        "id,nombre,email,telefono,celular,web,instagram,facebook,direccion,ciudad,pais,rubro_id,contacto_nombre,contacto_email,contacto_celular"
      )
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

    const e = empresa as {
      email?: string | null;
      contacto_email?: string | null;
      telefono?: string | null;
      celular?: string | null;
      contacto_celular?: string | null;
      contacto_nombre?: string | null;
      instagram?: string | null;
      direccion?: string | null;
    };
    const email = trimStr(e.email) ?? trimStr(e.contacto_email);
    const telefono = trimStr(e.telefono) ?? trimStr(e.celular) ?? trimStr(e.contacto_celular);
    const contacto = trimStr(e.contacto_nombre);
    const instagram = trimStr(e.instagram);
    const direccion = trimStr(e.direccion);

    // Siempre insert: nuevo lead con empresa_id y comercial_id (snapshot operativo + vínculo a entidad)
    const payload: Record<string, unknown> = {
      empresa_id: empresa.id,
      nombre: empresa.nombre,
      contacto,
      email,
      telefono,
      website: normalizeWebsite(empresa.web),
      instagram,
      direccion,
      origen: "Desde entidad",
      pipeline: "Nuevo",
      comercial_id: comercialId,
    };

    let { data: created, error: createErr } = await sb
      .from("leads")
      .insert(payload)
      .select("id")
      .single();
    if (
      createErr &&
      (isMissingColumnError(createErr.message, "leads", "instagram") ||
        isMissingColumnError(createErr.message, "leads", "direccion"))
    ) {
      const fallbackPayload = { ...payload };
      delete (fallbackPayload as { instagram?: string | null }).instagram;
      delete (fallbackPayload as { direccion?: string | null }).direccion;
      const fallbackRes = await sb
        .from("leads")
        .insert(fallbackPayload)
        .select("id")
        .single();
      created = fallbackRes.data;
      createErr = fallbackRes.error;
    }

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    if (!created?.id) return NextResponse.json({ error: "No se pudo crear el lead" }, { status: 500 });

    return NextResponse.json({ data: { lead_id: created.id } });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
