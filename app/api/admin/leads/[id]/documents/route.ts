import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { getLeadDocuments, type LeadDocumentType } from "@/lib/leads/leadDocuments";

export const dynamic = "force-dynamic";

const VALID_TYPES: LeadDocumentType[] = ["diagnostic", "strategy", "proposal"];

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** GET: devuelve { diagnostic?, strategy?, proposal? } desde lead_documents. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(_req, "leads.read");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const docs = await getLeadDocuments(sb, id);
    return NextResponse.json({ ok: true, documents: docs });
  } catch (e) {
    console.error("[documents GET]", e);
    return NextResponse.json(
      { ok: false, error: "Error cargando documentos del lead" },
      { status: 500 }
    );
  }
}

/** POST: upsert del último documento vigente por (lead_id, type). Requiere leads.write. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const type = body?.type as string | undefined;
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const generationId = typeof body?.generationId === "string" ? body.generationId.trim() : null;

    if (!type || !VALID_TYPES.includes(type as LeadDocumentType)) {
      return NextResponse.json(
        { ok: false, error: "type debe ser diagnostic, strategy o proposal" },
        { status: 400 }
      );
    }
    if (!url) {
      return NextResponse.json({ ok: false, error: "url es requerida" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const row = {
      lead_id: id,
      type,
      url,
      generation_id: generationId || null,
      created_at: new Date().toISOString(),
    };
    const { error } = await sb
      .from("lead_documents")
      .upsert(row, { onConflict: "lead_id,type" });

    if (error) {
      console.error("[documents POST] upsert error", error);
      return NextResponse.json(
        { ok: false, error: "Error guardando documento" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[documents POST]", e);
    return NextResponse.json(
      { ok: false, error: "Error guardando documento" },
      { status: 500 }
    );
  }
}
