/**
 * Prompts para los 3 documentos comerciales del flujo de venta consultiva:
 * 1) Diagnóstico Comercial — 2) Visión Estratégica — 3) Propuesta Comercial
 * Todos usan el mismo payload base (ProposalExportPayload).
 */

import type { ProposalExportPayload } from "@/lib/leads/proposalExportPayload";
import { buildGammaProPromptFromPayload, type ProposalPayloadForGamma } from "@/lib/ai/gammaPromptProfiles";

function safe(v: string | null | undefined): string {
  if (v == null || !String(v).trim()) return "—";
  return String(v).trim();
}

/**
 * ETAPA 1 — Diagnóstico Comercial (4–6 slides).
 * Abre la conversación. Tono consultivo, no vender servicios ni mencionar EASY como solución directa.
 */
export function buildDiagnosticPromptFromPayload(payload: ProposalExportPayload): string {
  const { lead, narrative } = payload;
  const lines: string[] = [];

  lines.push("# Diagnóstico Comercial — Presentación de análisis");
  lines.push("Genera un documento de diagnóstico profesional. 4 a 6 slides. Tono consultivo, lenguaje claro. No vender servicios ni mencionar a EASY como solución directa. Debe parecer un informe profesional de análisis.");
  lines.push("");
  lines.push("## Estructura (slides)");
  lines.push("1. Portada: título «Diagnóstico Comercial», cliente, fecha");
  lines.push("2. Situación actual del negocio");
  lines.push("3. Principales problemas detectados");
  lines.push("4. Oportunidades visibles");
  lines.push("5. Oportunidades ocultas");
  lines.push("6. Conclusión del diagnóstico");
  lines.push("");
  lines.push("## Datos");
  lines.push(`Cliente: ${safe(lead.empresa) || safe(lead.nombre)} | Rubro: ${safe(lead.rubro)} | Web: ${safe(lead.website)}`);
  if (narrative.summary) lines.push("Contexto: " + narrative.summary.slice(0, 400));
  if (narrative.objectives?.length) lines.push("Objetivos: " + narrative.objectives.join("; ").slice(0, 300));
  return lines.join("\n");
}

/**
 * ETAPA 2 — Visión Estratégica (6–8 slides).
 * Conecta diagnóstico con la solución. Aquí sí se puede mencionar EASY como partner estratégico.
 */
export function buildStrategicVisionPromptFromPayload(payload: ProposalExportPayload): string {
  const { lead, narrative } = payload;
  const lines: string[] = [];

  lines.push("# Visión Estratégica — Documento ejecutivo");
  lines.push("Genera un documento de visión estratégica. 6 a 8 slides. Conecta el diagnóstico con la solución. Puedes mencionar EASY como partner estratégico. Tono ejecutivo, genera autoridad.");
  lines.push("");
  lines.push("## Estructura (slides)");
  lines.push("1. Portada: Visión Estratégica");
  lines.push("2. Qué debería cambiar en el negocio");
  lines.push("3. Arquitectura comercial recomendada");
  lines.push("4. Infraestructura digital necesaria");
  lines.push("5. Cómo estructurar el proceso comercial");
  lines.push("6. Roadmap de implementación");
  lines.push("7. Resultados esperados");
  lines.push("8. Transición hacia la propuesta");
  lines.push("");
  lines.push("## Datos");
  lines.push(`Cliente: ${safe(lead.empresa) || safe(lead.nombre)} | Rubro: ${safe(lead.rubro)} | Web: ${safe(lead.website)}`);
  if (narrative.summary) lines.push("Contexto: " + narrative.summary.slice(0, 400));
  if (narrative.objectives?.length) lines.push("Objetivos: " + narrative.objectives.join("; ").slice(0, 300));
  if (narrative.whyNow) lines.push("Por qué actuar ahora: " + narrative.whyNow.slice(0, 250));
  return lines.join("\n");
}

/**
 * ETAPA 3 — Propuesta Comercial.
 * Reutiliza el prompt de 11 slides ya definido en gammaPromptProfiles.
 */
export function buildCommercialProposalPromptFromPayload(payload: ProposalPayloadForGamma): string {
  return buildGammaProPromptFromPayload(payload);
}
