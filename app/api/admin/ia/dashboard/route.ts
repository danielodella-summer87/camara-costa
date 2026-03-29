import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { hasRequiredPromptSectionsFromRow } from "@/lib/ai/promptStructure";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env de Supabase");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function allowDevOrRequire(req: NextRequest, perm: string) {
  if (process.env.NODE_ENV !== "production") return { id: "dev" };
  return await requirePermission(req, perm);
}

function parseExecutedPromptsCount(report: string | null | undefined): number {
  const text = String(report || "");
  if (!text.trim()) return 0;
  const matches = text.match(/###\s+TAB:\s*[^\n]+/g);
  return matches?.length ?? 0;
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/** Alineado con PUT profiles/.../prompts y save-full: solo `false` deshabilita. */
function isLinkEnabled(l: { enabled_by_default?: boolean | null }): boolean {
  return l.enabled_by_default !== false;
}

export async function GET(req: NextRequest) {
  const user = await allowDevOrRequire(req, "config.read");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const sb = supabaseAdmin();
    const [profilesRes, promptsRes, leadsRes] = await Promise.all([
      sb
        .from("ai_analysis_profiles")
        .select("id,name,is_active,updated_at")
        .order("name", { ascending: true }),
      sb
        .from("ai_prompts")
        .select(
          "id,name,status,prompt_content,updated_at,role_persona,context_environment,objective,specific_task,constraints,output_format,target_audience"
        ),
      sb
        .from("leads")
        .select("id,nombre,ai_report,ai_report_updated_at")
        .not("ai_report_updated_at", "is", null)
        .order("ai_report_updated_at", { ascending: false })
        .limit(25),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (promptsRes.error) throw promptsRes.error;
    if (leadsRes.error) throw leadsRes.error;

    const profiles = profilesRes.data ?? [];
    const prompts = promptsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const activeProfile = profiles.find((p) => p.is_active) ?? profiles[0] ?? null;

    let activeProfileLinks: Array<{
      prompt_id: string;
      execution_order: number;
      enabled_by_default: boolean;
      ai_prompts?: Array<{ id: string; name: string }> | null;
    }> = [];
    if (activeProfile?.id) {
      const linksRes = await sb
        .from("ai_profile_prompts")
        .select("prompt_id,execution_order,enabled_by_default,ai_prompts(id,name,category_id,ai_categories(name))")
        .eq("profile_id", activeProfile.id)
        .order("execution_order", { ascending: true });
      if (!linksRes.error) activeProfileLinks = linksRes.data ?? [];
    }

    type ProfileLinkRow = (typeof activeProfileLinks)[number];
    function promptFromLink(l: ProfileLinkRow) {
      const raw = l.ai_prompts;
      const p = Array.isArray(raw) ? raw[0] : raw;
      return p as
        | { id?: string; name?: string; category_id?: string | null; ai_categories?: { name?: string | null } | null }
        | null
        | undefined;
    }

    const enabledProfileLinks = activeProfileLinks.filter((l) => isLinkEnabled(l));
    const categoryCountMap = new Map<string, number>();
    for (const l of enabledProfileLinks) {
      const p = promptFromLink(l);
      const joinedName = p?.ai_categories?.name?.trim();
      const label = joinedName && joinedName.length > 0 ? joinedName : "Sin categoría";
      categoryCountMap.set(label, (categoryCountMap.get(label) ?? 0) + 1);
    }
    const prompts_by_category = Array.from(categoryCountMap.entries())
      .map(([category_name, count]) => ({ category_name, count }))
      .sort((a, b) => {
        if (a.category_name === "Sin categoría") return 1;
        if (b.category_name === "Sin categoría") return -1;
        return a.category_name.localeCompare(b.category_name, "es", { sensitivity: "base" });
      });

    const validatedPrompts = prompts.filter((p) => p.status === "validated");
    const promptsWithoutStructure = validatedPrompts.filter((p) => !hasRequiredPromptSectionsFromRow(p));
    const promptsWithErrors = prompts.filter((p) => !hasRequiredPromptSectionsFromRow(p));

    const executions = leads.map((l) => {
      const report = String(l.ai_report || "");
      const executed = parseExecutedPromptsCount(report);
      const hasError = report.toLowerCase().includes("error generando");
      return {
        lead: l.nombre || l.id,
        profile: activeProfile?.name || "—",
        prompts_executed: executed,
        duration: null as number | null,
        status: hasError ? "ERROR" : "OK",
        executed_at: l.ai_report_updated_at,
      };
    });

    const insightBase = leads.filter((l) => String(l.ai_report || "").trim().length > 0);
    const withPosicionamiento = insightBase.filter((l) => /posicionamiento/i.test(String(l.ai_report || ""))).length;
    const withoutDigitalStrategy = insightBase.filter((l) => /sin estrategia digital|no tiene estrategia digital/i.test(String(l.ai_report || ""))).length;
    const withOportunidades = insightBase.filter((l) => /oportunidad/i.test(String(l.ai_report || ""))).length;

    const data = {
      header: {
        active_profile_name: activeProfile?.name || "—",
        active_prompts_count: validatedPrompts.length,
        system_status: "Operativo",
        last_execution: leads[0]?.ai_report_updated_at ?? null,
      },
      profile_control: {
        active_profile_id: activeProfile?.id || "",
        active_profile_name: activeProfile?.name || "—",
        profiles: profiles.map((p) => ({ id: p.id, name: p.name, is_active: p.is_active })),
        associated_prompts_count: activeProfileLinks.filter((l) => isLinkEnabled(l)).length,
        execution_order: activeProfileLinks
          .filter((l) => isLinkEnabled(l))
          .map((l) => ({
            prompt_id: l.prompt_id,
            prompt_name: promptFromLink(l)?.name || l.ai_prompts?.[0]?.name || l.prompt_id,
            execution_order: l.execution_order,
          })),
      },
      prompts_by_category,
      recent_executions: executions,
      insights: {
        posicionamiento_issues_pct: pct(withPosicionamiento, insightBase.length),
        no_digital_strategy_pct: pct(withoutDigitalStrategy, insightBase.length),
        recurring_opportunities_pct: pct(withOportunidades, insightBase.length),
        sample_size: insightBase.length,
      },
      quality: {
        active_prompts: validatedPrompts.length,
        prompts_without_structure: promptsWithoutStructure.length,
        prompts_with_errors: promptsWithErrors.length,
      },
    };

    return NextResponse.json({ data }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error cargando dashboard IA" },
      { status: 500 }
    );
  }
}

