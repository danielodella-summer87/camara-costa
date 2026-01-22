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

function isUuidLike(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

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

type ApiResp<T> = { data?: T | null; error?: string | null };

const SELECT = "id,lead_id,filename,file_bucket,file_path,mime_type,file_size,created_at,created_by";

// GET /api/admin/leads/:id/docs => lista docs + signed_url
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
      .from("lead_docs")
      .select(SELECT)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const rows = (Array.isArray(data) ? (data as DocRow[]) : []) ?? [];

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

// POST /api/admin/leads/:id/docs => upload pdf + insert row
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

    // Validaciones
    const mime = (file.type || "").toLowerCase();
    if (mime !== "application/pdf") {
      return NextResponse.json({ data: null, error: "Solo se permite PDF" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // 10MB max
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { data: null, error: "PDF demasiado grande (máx 10MB)" } satisfies ApiResp<null>,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const bucket = "lead-docs"; // IMPORTANTE: debe existir en Storage
    const safeName = (file.name || "documento.pdf").replace(/[^\w.\-]+/g, "_");
    const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const docId = crypto.randomUUID();
    const path = `${leadId}/${docId}_${safeName}`;

    const supabase = supabaseAdmin();

    // Subir a storage
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

    // Insertar registro
    const toInsert = {
      id: docId,
      lead_id: leadId,
      filename: safeName,
      file_bucket: bucket,
      file_path: path,
      mime_type: "application/pdf",
      file_size: file.size,
    };

    const { data, error } = await supabase.from("lead_docs").insert(toInsert).select(SELECT).maybeSingle();

    if (error) {
      // Si falla DB, intentar borrar el archivo
      await supabase.storage.from(bucket).remove([path]).catch(() => {});
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // signed url para abrir directo
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);

    return NextResponse.json(
      { data: { ...(data as DocRow), signed_url: signed?.signedUrl ?? null }, error: null } satisfies ApiResp<any>,
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
