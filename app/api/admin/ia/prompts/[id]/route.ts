import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { generatePromptSuggestions } from "@/lib/ai/promptSuggestions";
import {
  buildPromptContentFromFields,
  canonicalPromptFromRow,
  hasRequiredStructuredFields,
  resolveStructuredFieldsFromRow,
  type PromptRowLike,
  type PromptStructuredFields,
} from "@/lib/ai/promptStructure";

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await allowDevOrRequire(req, "config.update");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string") patch.name = body.name.trim();
  if (typeof body?.type === "string") patch.type = body.type.trim();
  if (typeof body?.category_id === "string") patch.category_id = body.category_id.trim();
  if (typeof body?.description === "string" || body?.description === null) patch.description = body.description;
  if (body?.status === "draft" || body?.status === "validated") patch.status = body.status;
  const hasStructuredInput =
    typeof body?.role_persona === "string" ||
    typeof body?.context_environment === "string" ||
    typeof body?.objective === "string" ||
    typeof body?.specific_task === "string" ||
    typeof body?.constraints === "string" ||
    typeof body?.output_format === "string" ||
    typeof body?.target_audience === "string";

  const sb = supabaseAdmin();
  let currentFields: PromptStructuredFields = {
    role_persona: "",
    context_environment: "",
    objective: "",
    specific_task: "",
    constraints: "",
    output_format: "",
    target_audience: "",
  };
  if (hasStructuredInput || patch.status === "validated") {
    const { data: existing } = await sb
      .from("ai_prompts")
      .select("role_persona,context_environment,objective,specific_task,constraints,output_format,target_audience,prompt_content")
      .eq("id", id)
      .maybeSingle();
    currentFields = resolveStructuredFieldsFromRow((existing ?? {}) as PromptRowLike);
  }

  if (hasStructuredInput) {
    const nextFields: PromptStructuredFields = {
      role_persona:
        typeof body?.role_persona === "string" ? body.role_persona.trim() : String(currentFields.role_persona || "").trim(),
      context_environment:
        typeof body?.context_environment === "string"
          ? body.context_environment.trim()
          : String(currentFields.context_environment || "").trim(),
      objective: typeof body?.objective === "string" ? body.objective.trim() : String(currentFields.objective || "").trim(),
      specific_task:
        typeof body?.specific_task === "string" ? body.specific_task.trim() : String(currentFields.specific_task || "").trim(),
      constraints: typeof body?.constraints === "string" ? body.constraints.trim() : String(currentFields.constraints || "").trim(),
      output_format:
        typeof body?.output_format === "string" ? body.output_format.trim() : String(currentFields.output_format || "").trim(),
      target_audience:
        typeof body?.target_audience === "string" ? body.target_audience.trim() : String(currentFields.target_audience || "").trim(),
    };
    patch.role_persona = nextFields.role_persona;
    patch.context_environment = nextFields.context_environment;
    patch.objective = nextFields.objective;
    patch.specific_task = nextFields.specific_task;
    patch.constraints = nextFields.constraints;
    patch.output_format = nextFields.output_format;
    patch.target_audience = nextFields.target_audience || null;
    patch.prompt_content = buildPromptContentFromFields(nextFields);
    currentFields = nextFields;
  }

  // Regla de validación: nombre + categoría + prompt_content obligatorios para validated
  if (patch.status === "validated") {
    const { data: base } = await sb.from("ai_prompts").select("name,category_id").eq("id", id).maybeSingle();
    const n = typeof patch.name === "string" ? patch.name.trim() : String(base?.name ?? "").trim();
    const c = typeof patch.category_id === "string" ? patch.category_id.trim() : String(base?.category_id ?? "").trim();
    if (!hasRequiredStructuredFields(currentFields) || !n || !c) {
      return NextResponse.json(
        { error: "Para validar se requiere name, category_id y campos estructurados obligatorios completos." },
        { status: 400 }
      );
    }
  }
  const { data, error } = await sb
    .from("ai_prompts")
    .update(patch)
    .eq("id", id)
    .select("id,name,type,category_id,description,prompt_content,role_persona,context_environment,objective,specific_task,constraints,output_format,target_audience,status,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const suggestions = generatePromptSuggestions(String(data.name || ""), canonicalPromptFromRow(data as PromptRowLike));
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

  return NextResponse.json({ data }, { status: 200 });
}
