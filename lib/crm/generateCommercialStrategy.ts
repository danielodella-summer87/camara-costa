/**
 * Genera campos estructurados de estrategia comercial a partir de investigación + diagnóstico (+ inputs usuario).
 * Solo servidor (usa OPENAI_API_KEY).
 */

import type { CommercialStrategyFieldKey, CommercialStrategyUserInputs } from "./commercialStrategyTypes";
import { COMMERCIAL_STRATEGY_FIELD_KEYS } from "./commercialStrategyTypes";

export type GenerateStrategyLeadInput = {
  nombre?: string | null;
  empresa?: string | null;
  website?: string | null;
  objetivos?: string | null;
  audiencia?: string | null;
  initiative_kind?: string | null;
  project_description?: string | null;
};

const JSON_KEYS = COMMERCIAL_STRATEGY_FIELD_KEYS.join('", "');

const SYSTEM = `Eres estratega comercial B2B senior. Respondes SOLO con un objeto JSON válido (sin markdown) con las claves exactas: "${JSON_KEYS}".
Todos los valores son strings en español, claros para un comercial (no JSON anidado).
Basa el contenido ÚNICAMENTE en los extractos de investigación y diagnóstico provistos; si falta información, indícalo brevemente en justificacion sin inventar datos duros.
quick_wins: lista breve en texto (viñetas o párrafo corto).
canales_prioritarios: canales concretos (ej. LinkedIn, pauta, email, web).`;

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export async function generateCommercialStrategyContent(args: {
  lead: GenerateStrategyLeadInput;
  investigationExcerpt: string;
  diagnosticExcerpt: string;
  userInputs: CommercialStrategyUserInputs;
}): Promise<Record<CommercialStrategyFieldKey, string>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

  const { lead, investigationExcerpt, diagnosticExcerpt, userInputs } = args;
  const isStartup = String(lead.initiative_kind ?? "").trim().toLowerCase() === "startup";
  const userBlock = [
    `Lead: ${lead.nombre ?? ""} / Empresa: ${lead.empresa ?? ""}`,
    isStartup
      ? "Tipo de iniciativa: startup / proyecto temprano — no asumir presencia digital madura; basar el razonamiento en la descripción del proyecto y los extractos."
      : "",
    lead.project_description?.trim()
      ? `Descripción del proyecto (prioritaria):\n${clip(lead.project_description, 6000)}`
      : "",
    lead.website ? `Web: ${lead.website}` : "",
    lead.objetivos ? `Objetivos declarados: ${lead.objetivos}` : "",
    lead.audiencia ? `Audiencia: ${lead.audiencia}` : "",
    userInputs.prioridad_negocio ? `Prioridad negocio (usuario): ${userInputs.prioridad_negocio}` : "",
    userInputs.urgencia ? `Urgencia (usuario): ${userInputs.urgencia}` : "",
    userInputs.presupuesto ? `Presupuesto (usuario): ${userInputs.presupuesto}` : "",
    userInputs.restricciones ? `Restricciones (usuario): ${userInputs.restricciones}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userMessage = `${userBlock}

--- INVESTIGACIÓN (extracto) ---
${clip(investigationExcerpt, 12000)}

--- DIAGNÓSTICO (extracto) ---
${clip(diagnosticExcerpt, 12000)}

Devuelve el JSON con las 6 claves requeridas.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.45,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI: ${JSON.stringify(err)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("La IA no devolvió JSON válido");
  }

  const out = {} as Record<CommercialStrategyFieldKey, string>;
  for (const k of COMMERCIAL_STRATEGY_FIELD_KEYS) {
    const v = parsed[k];
    out[k] = typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "";
  }
  return out as Record<CommercialStrategyFieldKey, string>;
}
