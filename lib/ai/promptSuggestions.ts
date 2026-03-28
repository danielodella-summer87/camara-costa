import { buildStructuredPromptTemplate, hasRequiredPromptSections } from "@/lib/ai/promptStructure";

export type PromptSuggestionDraft = {
  suggestion_type: "missing_blocks" | "incomplete_structure" | "weak_restrictions" | "unclear_output_format" | "style_inconsistency";
  reason: string;
  suggested_content: string;
};

function hasSection(prompt: string, section: string): boolean {
  return prompt.toLowerCase().includes(section.toLowerCase());
}

function sectionBody(prompt: string, section: string): string {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`${escaped}\\s*\\n([\\s\\S]*?)(?=\\n[A-ZÁÉÍÓÚÑa-záéíóúñ ]+\\:\\s*\\n|$)`, "i");
  const m = prompt.match(rx);
  return m?.[1]?.trim() ?? "";
}

export function generatePromptSuggestions(promptName: string, promptContent: string): PromptSuggestionDraft[] {
  const text = String(promptContent || "").trim();
  const suggestions: PromptSuggestionDraft[] = [];
  const baseline = buildStructuredPromptTemplate();

  if (!hasRequiredPromptSections(text)) {
    suggestions.push({
      suggestion_type: "missing_blocks",
      reason: "Faltan uno o más bloques obligatorios de la estructura estándar.",
      suggested_content: buildStructuredPromptTemplate({
        task: text || `[Completar tarea específica para: ${promptName}]`,
      }),
    });
    return suggestions;
  }

  const objetivo = sectionBody(text, "Objetivo:");
  if (objetivo.length < 30) {
    suggestions.push({
      suggestion_type: "incomplete_structure",
      reason: "El bloque Objetivo es demasiado corto o ambiguo para guiar correctamente la salida.",
      suggested_content: text.replace(/Objetivo:\s*\n([\s\S]*?)\nTarea específica:/i, (_m, current) => {
        const val = String(current || "").trim() || "Definir con claridad el resultado esperado del análisis para este prompt.";
        return `Objetivo:\n${val}\n\nTarea específica:`;
      }),
    });
  }

  const restrictions = sectionBody(text, "Restricciones (Limitaciones):");
  if (!restrictions.includes("-") || restrictions.length < 50) {
    suggestions.push({
      suggestion_type: "weak_restrictions",
      reason: "Las restricciones son débiles o insuficientes para controlar calidad y consistencia.",
      suggested_content: text.replace(
        /Restricciones \(Limitaciones\):\s*\n([\s\S]*?)\nFormato de Salida:/i,
        "Restricciones (Limitaciones):\n- No inventar datos no disponibles; si faltan, declararlo.\n- Evitar generalidades y repetir contenido.\n- Priorizar claridad, impacto y viabilidad.\n\nFormato de Salida:"
      ),
    });
  }

  const output = sectionBody(text, "Formato de Salida:");
  if (output.length < 20 || !/secciones|bullets|bloques|títulos|titulos/i.test(output)) {
    suggestions.push({
      suggestion_type: "unclear_output_format",
      reason: "El formato de salida no define con suficiente precisión cómo debe estructurarse la respuesta.",
      suggested_content: text.replace(
        /Formato de Salida:\s*\n([\s\S]*)$/i,
        "Formato de Salida:\nResponder en secciones claras con títulos, usando bullets accionables y lenguaje directo, sin introducciones innecesarias."
      ),
    });
  }

  const hasColonHeadings = /(Rol \(Persona\)|Contexto\/Entorno|Objetivo|Tarea específica|Restricciones \(Limitaciones\)|Formato de Salida):/g.test(text);
  if (!hasColonHeadings) {
    suggestions.push({
      suggestion_type: "style_inconsistency",
      reason: "Se detectó inconsistencia de estilo en títulos o delimitación de secciones.",
      suggested_content: baseline,
    });
  }

  return suggestions;
}

