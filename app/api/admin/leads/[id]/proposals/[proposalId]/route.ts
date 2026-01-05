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

function isUuidLike(v: unknown) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function getIdFromReq(req: Request, params?: { proposalId?: string | string[] }) {
  const fromParams = params?.proposalId;
  const candidate = Array.isArray(fromParams) ? fromParams[0] : fromParams;
  if (candidate && typeof candidate === "string") return candidate;

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || null;
}

type ProposalRow = {
  id: string;
  lead_id: string;
  created_at: string;
  title: string | null;
  notes: string | null;
  file_bucket: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  sent_at: string | null;
};

type ApiResp<T> = { data?: T | null; error?: string | null };

const SELECT =
  "id,lead_id,created_at,title,notes,file_bucket,file_path,file_name,mime_type,file_size,sent_at";

// GET => metadata + signed_url (+ aliases url/file_url para UI)
export async function GET(req: Request, ctx: { params?: { proposalId?: string | string[] } }) {
  try {
    const proposalId = getIdFromReq(req, ctx?.params);
    if (!proposalId) {
      return NextResponse.json({ data: null, error: "Falta proposalId" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!isUuidLike(proposalId)) {
      return NextResponse.json(
        { data: null, error: "proposalId inválido (UUID)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("lead_proposals")
      .select(SELECT)
      .eq("id", proposalId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!data) {
      return NextResponse.json({ data: null, error: "No existe" } satisfies ApiResp<null>, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const row = data as ProposalRow;

    const { data: signed, error: sErr } = await supabase.storage
      .from(row.file_bucket)
      .createSignedUrl(row.file_path, 60 * 60);

    if (sErr) {
      return NextResponse.json({ data: null, error: sErr.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const signedUrl = signed?.signedUrl ?? null;

    return NextResponse.json(
      {
        data: {
          ...row,
          signed_url: signedUrl,
          url: signedUrl, // ✅ alias típico para UI
          file_url: signedUrl, // ✅ alias extra por compatibilidad
        },
        error: null,
      } satisfies ApiResp<any>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

// DELETE => borra archivo + registro
export async function DELETE(req: Request, ctx: { params?: { proposalId?: string | string[] } }) {
  try {
    const proposalId = getIdFromReq(req, ctx?.params);
    if (!proposalId) {
      return NextResponse.json({ data: null, error: "Falta proposalId" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!isUuidLike(proposalId)) {
      return NextResponse.json(
        { data: null, error: "proposalId inválido (UUID)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();

    // 1) traer row para saber bucket/path
    const { data: row, error: rErr } = await supabase
      .from("lead_proposals")
      .select(SELECT)
      .eq("id", proposalId)
      .maybeSingle();

    if (rErr) {
      return NextResponse.json({ data: null, error: rErr.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!row) {
      return NextResponse.json({ data: null, error: "No existe" } satisfies ApiResp<null>, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // 2) borrar archivo (si falla, igual seguimos con DB)
    await supabase.storage
      .from((row as any).file_bucket)
      .remove([(row as any).file_path])
      .catch(() => {});

    // 3) borrar registro
    const { data, error } = await supabase
      .from("lead_proposals")
      .delete()
      .eq("id", proposalId)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json({ data: data ?? { id: proposalId }, error: null } satisfies ApiResp<any>, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
