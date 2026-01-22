import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function safeStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

type ApiResp<T> = { data?: T | null; error?: string | null };

type DocRow = {
  id: string;
  lead_id: string;
  filename: string;
  file_bucket: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  created_by: string | null;
};

/**
 * GET /api/admin/leads/:id/docs/:docId
 * Devuelve 1 documento con signed_url fresca
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const sb = supabaseAdmin();
    const { id, docId } = await context.params;

    const leadId = safeStr(id);
    const docIdSafe = safeStr(docId);

    if (!leadId) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }
    if (!docIdSafe) {
      return NextResponse.json({ data: null, error: "docId requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    const { data: row, error } = await sb
      .from("lead_docs")
      .select("*")
      .eq("id", docIdSafe)
      .eq("lead_id", leadId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ data: null, error: "Documento no encontrado" } satisfies ApiResp<null>, {
        status: 404,
      });
    }

    // Generar signed_url fresca
    const bucket = safeStr(row.file_bucket);
    const path = safeStr(row.file_path);

    let signedUrl: string | null = null;
    if (bucket && path) {
      const { data: signed, error: sErr } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60); // 1h
      if (!sErr) {
        signedUrl = signed?.signedUrl ?? null;
      }
    }

    const payload = {
      ...row,
      signed_url: signedUrl,
      url: signedUrl,
    };

    return NextResponse.json({ data: payload, error: null } satisfies ApiResp<any>, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}

/**
 * DELETE /api/admin/leads/:id/docs/:docId
 * Elimina un documento y su archivo del storage
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const sb = supabaseAdmin();
    const { id, docId } = await context.params;

    const leadId = safeStr(id);
    const docIdSafe = safeStr(docId);

    if (!leadId) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }
    if (!docIdSafe) {
      return NextResponse.json({ data: null, error: "docId requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    // Obtener el documento para saber qué archivo borrar
    const { data: row, error: fetchError } = await sb
      .from("lead_docs")
      .select("*")
      .eq("id", docIdSafe)
      .eq("lead_id", leadId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ data: null, error: fetchError.message } satisfies ApiResp<null>, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ data: null, error: "Documento no encontrado" } satisfies ApiResp<null>, {
        status: 404,
      });
    }

    // Borrar archivo del storage si existe
    const bucket = safeStr(row.file_bucket);
    const path = safeStr(row.file_path);
    if (bucket && path) {
      await sb.storage.from(bucket).remove([path]).catch(() => {
        // Si falla borrar el archivo, continuamos igual (no bloqueamos)
      });
    }

    // Borrar registro de la DB
    const { error: delError } = await sb.from("lead_docs").delete().eq("id", docIdSafe).eq("lead_id", leadId);

    if (delError) {
      return NextResponse.json({ data: null, error: delError.message } satisfies ApiResp<null>, { status: 500 });
    }

    return NextResponse.json({ data: { deleted: true }, error: null } satisfies ApiResp<any>, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}
