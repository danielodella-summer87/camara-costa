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

// UUID “suave” (8-4-4-4-12)
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

function cleanDateToISO(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s.length) return null;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  }
  return null;
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

// GET /api/admin/leads/:id/proposals  => lista + signed_url
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: leadIdRaw } = await params;
    const leadId = (leadIdRaw ?? "").trim();

    if (!leadId) {
      return NextResponse.json({ data: null, error: "Falta id" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (!isUuidLike(leadId)) {
      return NextResponse.json({ data: null, error: "Id inválido (UUID)" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("lead_proposals")
      .select(SELECT)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const rows = (Array.isArray(data) ? (data as ProposalRow[]) : []) ?? [];

    // signed urls (1h)
    const withUrls = await Promise.all(
      rows.map(async (r) => {
        const { data: signed, error: sErr } = await supabase.storage
          .from(r.file_bucket)
          .createSignedUrl(r.file_path, 60 * 60);

        return {
          ...r,
          signed_url: sErr ? null : signed?.signedUrl ?? null,
        };
      })
    );

    return NextResponse.json({ data: withUrls, error: null } satisfies ApiResp<any>, {
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

// POST /api/admin/leads/:id/proposals  => upload pdf + insert row
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: leadIdRaw } = await params;
    const leadId = (leadIdRaw ?? "").trim();

    if (!leadId) {
      return NextResponse.json({ data: null, error: "Falta id" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (!isUuidLike(leadId)) {
      return NextResponse.json({ data: null, error: "Id inválido (UUID)" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ data: null, error: "Falta archivo (file)" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // validaciones básicas
    const mime = (file.type || "").toLowerCase();
    if (mime !== "application/pdf") {
      return NextResponse.json({ data: null, error: "Solo se permite PDF" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // 25MB max (ajustable)
    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { data: null, error: "PDF demasiado grande (máx 25MB)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const title = cleanStr(form.get("title"));
    const notes = cleanStr(form.get("notes"));
    const sentAt = cleanDateToISO(form.get("sent_at"));

    const bucket = "lead-proposals"; // IMPORTANTE: que exista en Storage
    const safeName = (file.name || "propuesta.pdf").replace(/[^\w.\-]+/g, "_");
    const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const path = `${leadId}/${ts}_${safeName}`;

    const supabase = supabaseAdmin();

    // subir a storage (File directo: más compatible que Uint8Array en types)
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (upErr) {
      return NextResponse.json({ data: null, error: upErr.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // insertar historial
    const toInsert = {
      lead_id: leadId,
      title,
      notes,
      file_bucket: bucket,
      file_path: path,
      file_name: safeName,
      mime_type: "application/pdf",
      file_size: file.size,
      sent_at: sentAt,
    };

    const { data, error } = await supabase.from("lead_proposals").insert(toInsert).select(SELECT).maybeSingle();

    if (error) {
      // si falla DB, intentamos borrar el archivo para no dejar basura
      await supabase.storage.from(bucket).remove([path]).catch(() => {});
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // signed url para abrir directo
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);

    return NextResponse.json(
      { data: { ...(data as ProposalRow), signed_url: signed?.signedUrl ?? null }, error: null } satisfies ApiResp<any>,
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}