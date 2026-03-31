import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { buildStrategyContextForServices, parseCommercialStrategyStored } from "@/lib/crm/commercialStrategyFlow";
import { buildInvestigationAndDiagnosticExcerpts } from "@/lib/crm/parseAiReportTabs";
import {
  mergeAgencyCatalog,
  truncate,
  validateRecommendations,
  type CatalogServiceForRecommendation,
  type ServiceRecommendationRaw,
} from "@/lib/leads/serviceRecommendationEngine";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "leads.read");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY no configurada" }, { status: 500 });
    }

    const { id: leadId } = await context.params;
    if (!leadId?.trim()) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .select("id,nombre,ai_report,commercial_strategy_json")
      .eq("id", leadId.trim())
      .maybeSingle();

    if (leadErr) {
      return NextResponse.json({ ok: false, error: leadErr.message }, { status: 500 });
    }
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead no encontrado" }, { status: 404 });
    }

    const { data: svcRows, error: svcErr } = await sb
      .from("agency_services")
      .select(
        "id,name,description,price_base,currency,unit,default_quantity,agency_service_categories(name)"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (svcErr) {
      return NextResponse.json({ ok: false, error: svcErr.message }, { status: 500 });
    }
    const services = Array.isArray(svcRows) ? svcRows : [];
    if (services.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No hay servicios activos en el catálogo de agencia." },
        { status: 400 }
      );
    }

    const ids = services.map((s) => s.id as string);
    const { data: effRows, error: effErr } = await sb
      .from("agency_service_effort_profiles")
      .select("agency_service_id,estimated_hours,agency_role_id,agency_roles(id,name,hourly_rate)")
      .in("agency_service_id", ids);

    if (effErr) {
      return NextResponse.json({ ok: false, error: effErr.message }, { status: 500 });
    }

    const catalog: CatalogServiceForRecommendation[] = mergeAgencyCatalog(
      services as Parameters<typeof mergeAgencyCatalog>[0],
      (effRows ?? []) as Parameters<typeof mergeAgencyCatalog>[1]
    );

    const aiReport = String((lead as { ai_report?: string | null }).ai_report ?? "");
    const { investigationExcerpt, diagnosticExcerpt } = buildInvestigationAndDiagnosticExcerpts(aiReport);
    const stored = parseCommercialStrategyStored(
      (lead as { commercial_strategy_json?: unknown }).commercial_strategy_json
    );
    const strategyText = buildStrategyContextForServices(stored);

    const catalogJson = catalog.map((c) => ({
      service_code: c.service_code,
      name: c.name,
      description: c.description,
      category: c.category,
      price_base: c.price_base,
      currency: c.currency,
      unit: c.unit,
      default_quantity: c.default_quantity,
      roles: c.roles.map((r) => ({
        role_code: r.role_code,
        role_name: r.role_name,
        hourly_rate: r.hourly_rate,
        default_hours: r.default_hours,
      })),
    }));

    const leadName = String((lead as { nombre?: string }).nombre ?? "").trim() || "Lead";

    const system = [
      "Eres un consultor comercial de agencia. Debes recomendar SOLO servicios que existan en el catálogo JSON.",
      "Cada service_code y role_code DEBE coincidir exactamente con un valor del catálogo (UUID).",
      "No inventes códigos ni nombres de servicios fuera del catálogo.",
      "Si un servicio no tiene roles en el catálogo, igual podés recomendarlo; dejá adjusted_role_hours vacío o usa roles si existen.",
      "Prioridad: entero 1 (más alta) a 5 (más baja).",
      "quantity: cantidad de unidades del servicio (número, puede ser decimal si aplica).",
      "suggested_ad_spend: solo si el servicio o el contexto implica inversión en pauta publicitaria (USD o misma moneda del precio; número o null).",
      "Respondé SOLO un JSON válido con la forma indicada en el mensaje de usuario.",
    ].join("\n");

    const userMsg = [
      `Lead: ${leadName}`,
      "",
      `--- Investigación (extracto) ---\n${truncate(investigationExcerpt, 8000)}`,
      "",
      `--- Diagnóstico (extracto) ---\n${truncate(diagnosticExcerpt, 8000)}`,
      "",
      `--- Estrategia comercial (texto) ---\n${truncate(strategyText, 8000)}`,
      "",
      "--- Catálogo (única fuente permitida) ---",
      JSON.stringify(catalogJson, null, 0),
      "",
      'Devolvé JSON con esta forma exacta: {"recommendations":[{"service_code":"<uuid>","priority":1,"quantity":1,"reason":"...","adjusted_role_hours":[{"role_code":"<uuid>","hours":10}],"suggested_client_note":"texto corto para el cliente","suggested_ad_spend":null}]}',
      "Incluí entre 3 y 8 recomendaciones si el contexto lo permite; ordená por priority (1 primero).",
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: (err as { error?: { message?: string } })?.error?.message ?? "Error OpenAI" },
        { status: 500 }
      );
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawText = completion?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rawText) {
      return NextResponse.json({ ok: false, error: "La IA no devolvió contenido" }, { status: 500 });
    }

    let parsed: { recommendations?: ServiceRecommendationRaw[] };
    try {
      parsed = JSON.parse(rawText) as { recommendations?: ServiceRecommendationRaw[] };
    } catch {
      return NextResponse.json({ ok: false, error: "Respuesta IA no es JSON válido" }, { status: 500 });
    }

    const rawList = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const { items, dropped } = validateRecommendations(rawList, catalog);

    return NextResponse.json({
      ok: true,
      recommendations: items,
      dropped_invalid_codes: dropped,
      catalog_size: catalog.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
