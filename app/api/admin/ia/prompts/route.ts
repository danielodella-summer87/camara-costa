import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import {
  buildPromptContentFromFields,
  getMissingRequiredPromptSectionsFromRow,
  hasRequiredStructuredFields,
  type PromptRowLike,
  type PromptStructuredFields,
} from "@/lib/ai/promptStructure";
import { generatePromptSuggestions } from "@/lib/ai/promptSuggestions";

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

export async function GET(req: NextRequest) {
  const user = await allowDevOrRequire(req, "config.read");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_prompts")
    .select("id,name,type,category_id,description,prompt_content,role_persona,context_environment,objective,specific_task,constraints,output_format,target_audience,status,created_at,updated_at,ai_categories(id,name)")
    .order("type", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pending, error: pErr } = await sb
    .from("ai_prompt_suggestions")
    .select("prompt_id")
    .eq("status", "pending");
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  const pendingCountByPrompt: Record<string, number> = {};
  (pending ?? []).forEach((row: { prompt_id?: string }) => {
    const id = String(row.prompt_id || "");
    if (!id) return;
    pendingCountByPrompt[id] = (pendingCountByPrompt[id] ?? 0) + 1;
  });

  const enriched = (data ?? []).map((row: PromptRowLike & { id: string }) => {
    const derived = {
      role_persona: String(row.role_persona ?? "").trim(),
      context_environment: String(row.context_environment ?? "").trim(),
      objective: String(row.objective ?? "").trim(),
      specific_task: String(row.specific_task ?? "").trim(),
      constraints: String(row.constraints ?? "").trim(),
      output_format: String(row.output_format ?? "").trim(),
      target_audience: String(row.target_audience ?? "").trim(),
    };
    const missing = getMissingRequiredPromptSectionsFromRow({ ...row, ...derived });
    const pendingCount = pendingCountByPrompt[String(row.id)] ?? 0;
    const prompt_health: "ok" | "mejorable" | "error" = missing.length > 0 ? "error" : pendingCount > 0 ? "mejorable" : "ok";
    return {
      ...row,
      ...derived,
      prompt_health,
      pending_suggestions_count: pendingCount,
      missing_required_blocks: missing,
    };
  });

  return NextResponse.json({ data: enriched }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const user = await allowDevOrRequire(req, "config.update");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const type = typeof body?.type === "string" ? body.type.trim() : "";
  const category_id = typeof body?.category_id === "string" ? body.category_id.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const structuredFields: PromptStructuredFields = {
    role_persona: typeof body?.role_persona === "string" ? body.role_persona.trim() : "",
    context_environment: typeof body?.context_environment === "string" ? body.context_environment.trim() : "",
    objective: typeof body?.objective === "string" ? body.objective.trim() : "",
    specific_task: typeof body?.specific_task === "string" ? body.specific_task.trim() : "",
    constraints: typeof body?.constraints === "string" ? body.constraints.trim() : "",
    output_format: typeof body?.output_format === "string" ? body.output_format.trim() : "",
    target_audience: typeof body?.target_audience === "string" ? body.target_audience.trim() : "",
  };
  const prompt_content = buildPromptContentFromFields(structuredFields);
  const status = body?.status === "validated" ? "validated" : "draft";
  if (!name || !type || !category_id) {
    return NextResponse.json({ error: "name, type y category_id son obligatorios" }, { status: 400 });
  }
  if (!hasRequiredStructuredFields(structuredFields)) {
    return NextResponse.json(
      {
        error: "Faltan campos requeridos: role_persona, context_environment, objective, specific_task, constraints, output_format.",
      },
      { status: 400 }
    );
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_prompts")
    .insert({
      name,
      type,
      category_id,
      description,
      prompt_content,
      role_persona: structuredFields.role_persona,
      context_environment: structuredFields.context_environment,
      objective: structuredFields.objective,
      specific_task: structuredFields.specific_task,
      constraints: structuredFields.constraints,
      output_format: structuredFields.output_format,
      target_audience: structuredFields.target_audience || null,
      status,
    })
    .select("id,name,type,category_id,description,prompt_content,role_persona,context_environment,objective,specific_task,constraints,output_format,target_audience,status,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const suggestions = generatePromptSuggestions(name, prompt_content);
  if (suggestions.length > 0 && data?.id) {
    const rows = suggestions.map((s) => ({
      prompt_id: data.id,
      suggested_content: s.suggested_content,
      suggestion_type: s.suggestion_type,
      reason: s.reason,
      status: "pending",
    }));
    await sb.from("ai_prompt_suggestions").insert(rows);
  }

  return NextResponse.json({ data }, { status: 201 });
}
