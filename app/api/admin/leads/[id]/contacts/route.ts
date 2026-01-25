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

type ContactCreateInput = {
  nombre: string;
  cargo: string;
  celular?: string | null;
  email?: string | null;
  es_principal?: boolean;
  notas?: string | null;
};

export async function GET(
  req: NextRequest,
  ctx: { params?: { id?: string } | Promise<{ id?: string }> }
) {
  try {
    const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params || {}));
    const leadId = params.id;

    if (!leadId) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("lead_contacts")
      .select("*")
      .eq("lead_id", leadId)
      .order("es_principal", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: data || [], error: null },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params?: { id?: string } | Promise<{ id?: string }> }
) {
  try {
    const params = await (ctx.params instanceof Promise ? ctx.params : Promise.resolve(ctx.params || {}));
    const leadId = params.id;

    if (!leadId) {
      return NextResponse.json(
        { data: null, error: "Falta parámetro id" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ContactCreateInput;

    if (!body.nombre || !body.nombre.trim()) {
      return NextResponse.json(
        { data: null, error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    if (!body.cargo || !body.cargo.trim()) {
      return NextResponse.json(
        { data: null, error: "El cargo es obligatorio" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // Si es_principal=true, primero desmarcar otros contactos principales
    if (body.es_principal) {
      await supabase
        .from("lead_contacts")
        .update({ es_principal: false })
        .eq("lead_id", leadId)
        .eq("es_principal", true);
    }

    // Crear el nuevo contacto
    const { data, error } = await supabase
      .from("lead_contacts")
      .insert({
        lead_id: leadId,
        nombre: body.nombre.trim(),
        cargo: body.cargo.trim(),
        celular: body.celular?.trim() || null,
        email: body.email?.trim() || null,
        es_principal: body.es_principal || false,
        notas: body.notas?.trim() || null,
      })
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
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}
