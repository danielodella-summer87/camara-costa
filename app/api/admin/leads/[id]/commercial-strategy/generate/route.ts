import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { updateLeadSafe } from "@/lib/leads/updateLeadSafe";
import { generateCommercialStrategyContent } from "@/lib/crm/generateCommercialStrategy";
import { buildInvestigationAndDiagnosticExcerpts } from "@/lib/crm/parseAiReportTabs";
import type { CommercialStrategyStored, CommercialStrategyUserInputs } from "@/lib/crm/commercialStrategyTypes";
import { emptyCommercialStrategyStored } from "@/lib/crm/commercialStrategyTypes";
import { COMMERCIAL_STRATEGY_FIELD_KEYS } from "@/lib/crm/commercialStrategyTypes";
import { parseCommercialStrategyStored } from "@/lib/crm/commercialStrategyFlow";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = safeId(rawId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      regenerate?: boolean;
      userInputs?: CommercialStrategyUserInputs;
    };

    const sb = supabaseAdmin();
    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .select(
        "id,nombre,ai_report,commercial_strategy_json,empresas:empresa_id(nombre),website,objetivos,audiencia,initiative_kind,project_description"
      )
      .eq("id", id)
      .maybeSingle();

    if (leadErr) throw leadErr;
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead no encontrado" }, { status: 404 });
    }

    const aiReport = String(lead.ai_report ?? "").trim();
    if (!aiReport) {
      return NextResponse.json(
        { ok: false, error: "Falta investigación (informe IA). Completá el Paso 1 primero." },
        { status: 400 }
      );
    }

    const { investigationExcerpt, diagnosticExcerpt } = buildInvestigationAndDiagnosticExcerpts(aiReport);
    if (!diagnosticExcerpt.trim()) {
      return NextResponse.json(
        { ok: false, error: "No hay material de diagnóstico en el informe. Completá el Paso 2 primero." },
        { status: 400 }
      );
    }

    const prev = parseCommercialStrategyStored(lead.commercial_strategy_json) ?? emptyCommercialStrategyStored();
    const userInputs: CommercialStrategyUserInputs = {
      ...prev.userInputs,
      ...(body.userInputs ?? {}),
    };

    const emp = lead.empresas as { nombre?: string } | { nombre?: string }[] | null;
    const empresaNombre = Array.isArray(emp) ? emp[0]?.nombre ?? null : emp?.nombre ?? null;

    const generated = await generateCommercialStrategyContent({
      lead: {
        nombre: lead.nombre,
        empresa: empresaNombre,
        website: lead.website,
        objetivos: lead.objetivos,
        audiencia: lead.audiencia,
        initiative_kind: (lead as { initiative_kind?: string | null }).initiative_kind ?? null,
        project_description: (lead as { project_description?: string | null }).project_description ?? null,
      },
      investigationExcerpt,
      diagnosticExcerpt,
      userInputs,
    });

    const next: CommercialStrategyStored = {
      generated: { ...generated },
      edited: body.regenerate ? {} : { ...prev.edited },
      userInputs,
    };

    if (!body.regenerate) {
      for (const k of COMMERCIAL_STRATEGY_FIELD_KEYS) {
        if (!next.edited[k] && prev.edited[k]) next.edited[k] = prev.edited[k];
      }
    }

    const updateResult = await updateLeadSafe(
      sb,
      id,
      {
        commercial_strategy_json: next,
        strategy_approved_at: null,
      },
      { force_unlink_entity: false }
    );

    if (updateResult.error) {
      return NextResponse.json(
        { ok: false, error: updateResult.error?.message ?? "Error al guardar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, strategy: next });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
