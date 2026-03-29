import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { buildStructuredPromptTemplate, hasRequiredPromptSectionsFromRow } from "@/lib/ai/promptStructure";

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

const SECTION_LABELS = [
  "Rol (Persona)",
  "Contexto/Entorno",
  "Objetivo",
  "Tarea específica",
  "Restricciones (Limitaciones)",
  "Formato de Salida",
] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(content: string, label: string): string {
  const nextLabels = SECTION_LABELS.filter((l) => l !== label).map((l) => escapeRegex(l)).join("|");
  const pattern = new RegExp(`${escapeRegex(label)}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${nextLabels})\\s*:|$)`, "i");
  const match = content.match(pattern);
  return String(match?.[1] ?? "").trim();
}

function normalizePromptContent(name: string, content: string): string {
  const text = String(content || "").trim();
  if (!text) return buildStructuredPromptTemplate({ objective: `Definir un análisis claro y accionable para ${name || "el negocio"}.` });
  if (hasRequiredPromptSectionsFromRow({ prompt_content: text })) return text;

  const role = extractSection(text, "Rol (Persona)");
  const context = extractSection(text, "Contexto/Entorno");
  const objective = extractSection(text, "Objetivo");
  const task = extractSection(text, "Tarea específica");
  const constraints = extractSection(text, "Restricciones (Limitaciones)");
  const outputFormat = extractSection(text, "Formato de Salida");

  return buildStructuredPromptTemplate({
    role: role || undefined,
    context: context || undefined,
    objective: objective || `Lograr un resultado útil, consistente y accionable para ${name || "el negocio"}.`,
    task: task || text,
    constraints: constraints || undefined,
    output_format: outputFormat || undefined,
  });
}

export async function POST(req: NextRequest) {
  const user = await allowDevOrRequire(req, "config.update");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ai_prompts")
    .select("id,name,status,prompt_content")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = (data ?? []).filter((p: { status?: string | null }) => String(p?.status || "").trim().toLowerCase() !== "validated");
  if (candidates.length === 0) {
    return NextResponse.json({ data: { scanned: 0, updated: 0, updated_prompt_ids: [] } }, { status: 200 });
  }

  const updatedPromptIds: string[] = [];
  for (const row of candidates) {
    const normalized = normalizePromptContent(String(row?.name || ""), String(row?.prompt_content || ""));
    const { error: upErr } = await sb
      .from("ai_prompts")
      .update({ prompt_content: normalized, status: "validated" })
      .eq("id", row.id);
    if (!upErr) updatedPromptIds.push(String(row.id));
  }

  return NextResponse.json(
    {
      data: {
        scanned: candidates.length,
        updated: updatedPromptIds.length,
        updated_prompt_ids: updatedPromptIds,
      },
    },
    { status: 200 }
  );
}

