import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ✅ validación “suave”: solo formato 8-4-4-4-12 (hex), sin exigir versión RFC
function isUuidLike(v: unknown) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

type BulkPatchBody = {
  ids?: unknown;
  pipeline?: unknown;
};

type BulkDeleteBody = {
  ids?: unknown;
};

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as BulkPatchBody;

    const idsRaw = Array.isArray(body.ids) ? body.ids : [];
    const ids = idsRaw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(isUuidLike);

    const pipeline = cleanStr(body.pipeline);

    if (!ids.length) {
      return NextResponse.json({ data: null, error: "ids inválidos o vacíos" }, { status: 400 });
    }
    if (!pipeline) {
      return NextResponse.json({ data: null, error: "pipeline es obligatorio" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("leads")
      .update({ pipeline })
      .in("id", ids)
      .select("id,pipeline,updated_at");

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: { updated: (data ?? []).length, rows: data ?? [] }, error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as BulkDeleteBody;

    const idsRaw = Array.isArray(body.ids) ? body.ids : [];
    const ids = idsRaw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(isUuidLike);

    if (!ids.length) {
      return NextResponse.json({ data: null, error: "ids inválidos o vacíos" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase.from("leads").delete().in("id", ids).select("id");

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: { deleted: (data ?? []).length, ids: (data ?? []).map((r) => r.id) }, error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}