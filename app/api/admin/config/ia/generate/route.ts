import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { buildStructuredPromptTemplate, hasRequiredPromptSectionsFromRow } from "@/lib/ai/promptStructure";

export const dynamic = "force-dynamic";

type GenerateBody = {
  role?: string;
  context?: string;
  task?: string;
  constraints?: string;
  output_format?: string;
  objective?: string;
  label?: string;
  category?: string;
};

async function allowDevOrRequire(req: NextRequest, perm: string) {
  if (process.env.NODE_ENV !== "production") return { id: "dev" };
  return await requirePermission(req, perm);
}

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const user = await allowDevOrRequire(req, "config.update");
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as GenerateBody;
    const role = clean(body.role);
    const context = clean(body.context);
    const task = clean(body.task);
    const constraints = clean(body.constraints);
    const output_format = clean(body.output_format);
    const objective = clean(body.objective);
    const label = clean(body.label);
    const category = clean(body.category);

    const userContent = [
      `Bloque: ${category || "General"} / ${label || "Sin etiqueta"}`,
      `Rol/persona: ${role || "(no definido)"}`,
      `Contexto/entorno: ${context || "(no definido)"}`,
      `Tarea específica: ${task || "(no definida)"}`,
      `Restricciones/excepciones: ${constraints || "(sin restricciones explícitas)"}`,
      `Formato de salida esperado: ${output_format || "(no definido)"}`,
      `Objetivo del bloque: ${objective || "(no definido)"}`,
      "",
      "Devuelve un prompt final en español, listo para pegar, claro y accionable.",
      "OBLIGATORIO: usa exactamente estos bloques y en este orden:",
      "1) Rol (Persona)",
      "2) Contexto/Entorno",
      "3) Objetivo",
      "4) Tarea específica",
      "5) Restricciones (Limitaciones)",
      "6) Formato de Salida",
      "No agregues explicación fuera del prompt.",
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "Eres un especialista en prompt engineering. Tu salida debe ser exclusivamente el prompt final, sin preámbulos ni markdown.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json({ error: err?.error?.message ?? "Error generando prompt" }, { status: 500 });
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const generated = json?.choices?.[0]?.message?.content?.trim() || "";
    if (!generated) {
      return NextResponse.json({ error: "La IA no devolvió contenido" }, { status: 500 });
    }

    const finalPrompt = hasRequiredPromptSectionsFromRow({ prompt_content: generated })
      ? generated
      : buildStructuredPromptTemplate({
          role,
          context,
          objective,
          task,
          constraints,
          output_format,
        });

    return NextResponse.json({ data: { generated_prompt: finalPrompt } }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error inesperado generando prompt" },
      { status: 500 }
    );
  }
}
