import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateLeadSafe } from "@/lib/leads/updateLeadSafe";

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
    const params = ctx?.params ? await Promise.resolve(ctx.params as any) : undefined;
    const empresaId = params?.id;

    if (!empresaId || typeof empresaId !== "string") {
      return NextResponse.json({ error: "empresaId faltante o inválido en la URL" }, { status: 400 });
    }

    const sb = supabaseAdmin();

    // Validar "empresa existe" (NO formato)
    const { data: empresa, error: empErr } = await sb
      .from("empresas")
      .select("id,nombre,email,telefono,web,instagram,direccion,rubro_id")
      .eq("id", empresaId)
      .maybeSingle();

    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 });
    if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

    // Evitar duplicados (si ya existe lead para esa empresa)
    const { data: existingLead, error: leadCheckErr } = await sb
      .from("leads")
      .select("id")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadCheckErr) return NextResponse.json({ error: leadCheckErr.message }, { status: 500 });

    if (existingLead?.id) {
      // Asegurar que empresa_id esté seteado (por si quedó nulo por alguna corrida anterior)
      // Usar helper seguro (aquí queremos SETEAR empresa_id explícitamente, es un cambio intencional)
      await updateLeadSafe(sb, existingLead.id, { empresa_id: empresa.id }, {
        force_unlink_entity: false, // Estamos vinculando, no desvinculando
      });
      
      return NextResponse.json({ data: { lead_id: existingLead.id, already_existed: true } });
    }

    // Insert del lead (vinculando empresa_id)
    const payload: any = {
      empresa_id: empresa.id,
      nombre: empresa.nombre,
      email: empresa.email ?? null,
      telefono: empresa.telefono ?? null,
      website: normalizeWebsite(empresa.web),
      notas: empresa.instagram ? `IG: ${empresa.instagram}` : null,
      origen: "Desde entidad",
      pipeline: "Nuevo",
    };

    const { data: created, error: createErr } = await sb
      .from("leads")
      .insert(payload)
      .select("id")
      .single();

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

    return NextResponse.json({ data: { lead_id: created.id, already_existed: false } });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
