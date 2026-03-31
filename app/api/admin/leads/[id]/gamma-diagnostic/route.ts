import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { createGammaFromTemplate } from "@/lib/integrations/gamma";
import { buildDiagnosticPromptFromPayload } from "@/lib/ai/gammaProfilesCommercialDocs";
import { buildProposalExportPayload } from "@/lib/leads/proposalExportPayload";
import { LEAD_SERVICE_PROPOSALS_LIST_SELECT, mapLeadServiceProposalRows } from "@/lib/leads/mapLeadServiceProposalRows";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(req, "leads.read");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: leadRow, error: leadErr } = await sb
      .from("leads")
      .select(
        "id,nombre,website,proposal_draft_json,proposal_confirmed_at,empresa_id,empresas:empresa_id(id,nombre,web,rubro_id,rubros:rubro_id(nombre))"
      )
      .eq("id", id)
      .maybeSingle();

    if (leadErr) throw new Error(leadErr.message);
    if (!leadRow) {
      return NextResponse.json({ ok: false, error: "Lead no encontrado" }, { status: 404 });
    }

    const lead = leadRow as any;
    let leadServices = [] as ReturnType<typeof mapLeadServiceProposalRows>;
    try {
      const { data: svcRows } = await sb
        .from("lead_service_proposals")
        .select(LEAD_SERVICE_PROPOSALS_LIST_SELECT)
        .eq("lead_id", id)
        .order("mes", { ascending: true })
        .order("orden", { ascending: true });
      if (svcRows?.length) {
        leadServices = mapLeadServiceProposalRows(svcRows);
      }
    } catch {
      // ignorar
    }

    const payload = buildProposalExportPayload({
      lead: {
        id: lead.id,
        nombre: lead.nombre,
        website: lead.website,
        proposal_draft_json: lead.proposal_draft_json,
        proposal_confirmed_at: lead.proposal_confirmed_at,
        empresas: lead.empresas,
      },
      leadServices,
    });

    const prompt = buildDiagnosticPromptFromPayload(payload);
    if (process.env.NODE_ENV !== "production") {
      console.log("[COMMERCIAL DOC] type: diagnostic");
      console.log("[COMMERCIAL DOC] prompt length:", prompt.length);
    }

    const data = await createGammaFromTemplate({ profile: "comercial", prompt });
    const generationId =
      (data && typeof data === "object" && (data.generationId ?? (data as { id?: string; generation_id?: string }).id ?? (data as { id?: string; generation_id?: string }).generation_id)) ?? null;
    if (!generationId || typeof generationId !== "string") {
      console.error("[GAMMA diagnostic] Respuesta sin generationId", data);
      return NextResponse.json(
        { ok: false, error: "No se pudo iniciar la generación del documento." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      generationId,
      status: "pending",
    });
  } catch (e: any) {
    const responseText = e?.message ?? String(e);
    if (/GAMMA_API_KEY/i.test(responseText)) {
      console.error("[GAMMA diagnostic] Configuración faltante:", responseText);
      return NextResponse.json(
        { ok: false, error: "El servicio de presentaciones no está disponible. Contacte al administrador del sistema." },
        { status: 503 }
      );
    }
    const isGammaTimeoutOrServerError =
      /cloudflare/i.test(responseText) ||
      /error code:\s*524/i.test(responseText) ||
      /<html/i.test(responseText);

    if (isGammaTimeoutOrServerError) {
      console.error("Gamma timeout or server error", responseText);
      return NextResponse.json(
        { ok: false, error: "Gamma tardó demasiado en responder. Intenta nuevamente." },
        { status: 502 }
      );
    }
    console.error("[GAMMA diagnostic] Error:", responseText);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error generando diagnóstico" },
      { status: 500 }
    );
  }
}
