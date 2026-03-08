import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { createGammaFromTemplate } from "@/lib/integrations/gamma";
import { buildStrategicVisionPromptFromPayload } from "@/lib/ai/gammaProfilesCommercialDocs";
import { buildProposalExportPayload } from "@/lib/leads/proposalExportPayload";

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
    let leadServices: Array<{ id: string; service_id: string; codigo?: string | null; nombre?: string | null; mes?: number; precio?: number | null; moneda?: string | null; alcance_editado?: string | null; observaciones?: string | null; billing_type?: string | null }> = [];
    try {
      const { data: svcRows } = await sb
        .from("lead_service_proposals")
        .select("id,lead_id,service_id,mes,precio,moneda,alcance_editado,observaciones,orden,easy_services(codigo,nombre,billing_type)")
        .eq("lead_id", id)
        .order("mes", { ascending: true })
        .order("orden", { ascending: true });
      if (svcRows?.length) {
        leadServices = (svcRows as any[]).map((r) => ({
          id: r.id,
          service_id: r.service_id,
          codigo: r.easy_services?.codigo ?? null,
          nombre: r.easy_services?.nombre ?? null,
          mes: r.mes,
          precio: r.precio,
          moneda: r.moneda,
          alcance_editado: r.alcance_editado,
          observaciones: r.observaciones,
          billing_type: r.easy_services?.billing_type ?? null,
        }));
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

    const prompt = buildStrategicVisionPromptFromPayload(payload);
    if (process.env.NODE_ENV !== "production") {
      console.log("[COMMERCIAL DOC] type: strategy");
      console.log("[COMMERCIAL DOC] prompt length:", prompt.length);
    }

    const { generationId } = await createGammaFromTemplate({ profile: "comercial", prompt });

    return NextResponse.json({
      ok: true,
      docType: "strategy",
      generationId,
      status: "pending",
    });
  } catch (e: any) {
    const responseText = e?.message ?? String(e);
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
    console.error("[GAMMA strategy] Error:", responseText);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error generando visión estratégica" },
      { status: 500 }
    );
  }
}
