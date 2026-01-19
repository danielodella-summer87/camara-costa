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
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const sb = supabaseAdmin();
  const { id: empresaId } = await context.params;

  // 1) Traer empresa
  const { data: empresa, error: empErr } = await sb
    .from("empresas")
    .select("id,nombre,email,telefono,web,instagram,direccion,rubro_id")
    .eq("id", empresaId)
    .maybeSingle();

  if (empErr) {
    return NextResponse.json({ error: empErr.message }, { status: 500 });
  }
  if (!empresa) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  // 2) Si ya existe lead para esa empresa, devolverlo
  const { data: existingLead, error: leadCheckErr } = await sb
    .from("leads")
    .select("id")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (leadCheckErr) {
    return NextResponse.json({ error: leadCheckErr.message }, { status: 500 });
  }
  if (existingLead?.id) {
    return NextResponse.json({ data: { lead_id: existingLead.id, already_existed: true } });
  }

  // 3) Crear lead copiando datos base
  const payload: any = {
    empresa_id: empresa.id,
    nombre: empresa.nombre,
    email: empresa.email ?? null,
    telefono: empresa.telefono ?? null,
    website: normalizeWebsite(empresa.web),
    notas: empresa.instagram ? `IG: ${empresa.instagram}` : null,
    // defaults razonables (ajustables luego)
    origen: "EMPRESAS",
    pipeline: "Nuevo",
  };

  // Si tu tabla leads tiene rubro_id y querés copiarlo:
  // payload.rubro_id = empresa.rubro_id ?? null;

  const { data: created, error: createErr } = await sb
    .from("leads")
    .insert(payload)
    .select("id")
    .single();

  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 500 });
  }

  return NextResponse.json({ data: { lead_id: created.id, already_existed: false } });
}
