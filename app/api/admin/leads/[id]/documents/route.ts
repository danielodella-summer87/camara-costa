import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import {
  getLeadDocumentsPayload,
  upsertLeadDocumentUrl,
  type LeadDocumentType,
  type UpsertLeadDocumentMeta,
} from "@/lib/leads/leadDocuments";
import { isBlockedGammaSourceForPersistence } from "@/lib/leads/gammaDocumentPolicy";

export const dynamic = "force-dynamic";

const VALID_TYPES: LeadDocumentType[] = ["diagnostic", "strategy", "proposal", "presentation"];

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** GET: devuelve URLs por tipo desde lead_documents (incl. presentation). */
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
    const { documents, archiveByType, versionSummaries } = await getLeadDocumentsPayload(sb, id, {
      includeVersionSummaries: true,
    });
    return NextResponse.json({
      ok: true,
      documents,
      archiveByType,
      versionSummaries: versionSummaries ?? [],
    });
  } catch (e) {
    console.error("[documents GET]", e);
    return NextResponse.json(
      { ok: false, error: "Error cargando documentos del lead" },
      { status: 500 }
    );
  }
}

/** POST: nueva versión del documento por tipo (historial en lead_documents). Requiere leads.write. */
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
    let url = typeof body?.url === "string" ? body.url.trim() : "";
    const generationId = typeof body?.generationId === "string" ? body.generationId.trim() : null;
    const metaBody: UpsertLeadDocumentMeta = {};
    if (typeof body?.source === "string" && body.source.trim()) metaBody.source = body.source.trim();
    if (typeof body?.gammaUrl === "string") metaBody.gammaUrl = body.gammaUrl.trim() || null;
    if (typeof body?.fileUrl === "string") metaBody.fileUrl = body.fileUrl.trim() || null;
    if (body?.status === "pending" || body?.status === "archived" || body?.status === "failed") {
      metaBody.status = body.status;
    }
    if (typeof body?.notes === "string" && body.notes.trim()) metaBody.notes = body.notes.trim();
    if (user?.id) metaBody.createdBy = user.id;
    const metaOpt = Object.keys(metaBody).length > 0 ? metaBody : null;
    const markdown =
      typeof body?.markdown === "string" && body.markdown.trim().length > 0 ? body.markdown.trim() : "";

    if (!type || !VALID_TYPES.includes(type as LeadDocumentType)) {
      return NextResponse.json(
        { ok: false, error: "type debe ser diagnostic, strategy, proposal o presentation" },
        { status: 400 }
      );
    }
    /** Propuesta generada en LEADS87: markdown → data URL (tabla lead_documents exige url NOT NULL). */
    if (!url && type === "proposal" && markdown) {
      url = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
    }
    if (!url) {
      return NextResponse.json(
        { ok: false, error: "Se requiere url o, para type=proposal, el campo markdown con el contenido." },
        { status: 400 }
      );
    }

    if (!url.startsWith("data:") && isBlockedGammaSourceForPersistence(url)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pueden guardar como documento oficial enlaces efímeros de Gamma ni solo la web de Gamma. Exportá el PDF y usá el archivado automático (el sistema llama a mirror-pdf) o una URL de almacenamiento propio.",
        },
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();
    const { error: upErr } = await upsertLeadDocumentUrl(
      sb,
      id,
      type as LeadDocumentType,
      url,
      generationId,
      metaOpt
    );
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr }, { status: 500 });
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
