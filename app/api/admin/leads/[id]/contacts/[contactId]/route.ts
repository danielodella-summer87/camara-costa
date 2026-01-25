import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

type ContactUpdateInput = {
  nombre?: string;
  cargo?: string;
  telefono?: string | null;
  email?: string | null;
  is_primary?: boolean;
  notas?: string | null;
};

async function getLeadIdFromContact(contactId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("lead_contacts")
    .select("lead_id")
    .eq("id", contactId)
    .single();

  if (error || !data) return null;
  return data.lead_id;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params?: { id?: string; contactId?: string } | Promise<{ id?: string; contactId?: string }> }
) {
  try {
    const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params || {}));
    const contactId = params.contactId;

    if (!contactId) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro contactId" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ContactUpdateInput;

    // Validar campos obligatorios si vienen en el update
    if (body.nombre !== undefined && !body.nombre?.trim()) {
      return NextResponse.json(
        { data: null, error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    if (body.cargo !== undefined && !body.cargo?.trim()) {
      return NextResponse.json(
        { data: null, error: "El cargo es obligatorio" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Si se está marcando como principal, desmarcar otros
    if (body.is_primary === true) {
      const leadId = await getLeadIdFromContact(contactId);
      if (leadId) {
        await supabase
          .from("lead_contacts")
          .update({ is_primary: false })
          .eq("lead_id", leadId)
          .eq("is_primary", true)
          .neq("id", contactId);
      }
    }

    // Preparar update
    const update: any = {};
    if (body.nombre !== undefined) update.nombre = body.nombre.trim();
    if (body.cargo !== undefined) update.cargo = body.cargo.trim();
    if (body.telefono !== undefined) update.telefono = body.telefono?.trim() || null;
    if (body.email !== undefined) update.email = body.email?.trim() || null;
    if (body.is_primary !== undefined) update.is_primary = body.is_primary;
    if (body.notas !== undefined) update.notas = body.notas?.trim() || null;

    const { data, error } = await supabase
      .from("lead_contacts")
      .update(update)
      .eq("id", contactId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data, error: null },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params?: { id?: string; contactId?: string } | Promise<{ id?: string; contactId?: string }> }
) {
  try {
    const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params || {}));
    const contactId = params.contactId;

    if (!contactId) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro contactId" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const { error } = await supabase
      .from("lead_contacts")
      .delete()
      .eq("id", contactId);

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: { success: true }, error: null },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}
