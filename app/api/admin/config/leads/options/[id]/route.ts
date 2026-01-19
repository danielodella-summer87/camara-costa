import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sb = supabaseAdmin();
    const { id } = await params;

    if (!id) return NextResponse.json({ data: null, error: "id requerido" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as
      | Partial<{
          label: string;
          sort: number;
          is_active: boolean;
        }>
      | null;

    const patch: any = { updated_at: new Date().toISOString() };
    if (typeof body?.label === "string") patch.label = body.label.trim();
    if (Number.isFinite(body?.sort as any)) patch.sort = Number(body!.sort);
    if (typeof body?.is_active === "boolean") patch.is_active = body.is_active;

    const { data, error } = await sb
      .from("lead_picklist_items")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sb = supabaseAdmin();
    const { id } = await params;

    if (!id) return NextResponse.json({ data: null, error: "id requerido" }, { status: 400 });

    const { error } = await sb.from("lead_picklist_items").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ data: true, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" }, { status: 500 });
  }
}