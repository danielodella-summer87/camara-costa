/**
 * Genera migrations/056_modo_easy_v22_prompts.sql con prompt_content alineado a campos estructurados.
 * Uso: node scripts/gen-mod-easy-v22-migration.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function line(v) {
  const s = typeof v === "string" ? v.trim() : "";
  return s || "[Completar]";
}

function buildPromptContent(fields) {
  const blocks = [
    "Rol (Persona):",
    line(fields.role_persona),
    "",
    "Contexto/Entorno:",
    line(fields.context_environment),
    "",
    "Objetivo:",
    line(fields.objective),
    "",
    "Tarea específica:",
    line(fields.specific_task),
    "",
    "Restricciones (Limitaciones):",
    line(fields.constraints),
    "",
    "Formato de Salida:",
    line(fields.output_format),
  ];
  const audience = String(fields.target_audience ?? "").trim();
  if (audience) blocks.push("", "Público objetivo:", audience);
  return blocks.join("\n");
}

const audience =
  "Empresas y leads en análisis comercial bajo el perfil Agencia de Marketing / MODO EASY (decisión, crecimiento y cierre).";

const seniorBlocks = `La respuesta DEBE usar estos bloques con estos títulos exactos (en este orden):

**Resumen ejecutivo** (máx. 5 líneas; tono consultivo senior).

**Insight clave** — la lectura más útil para decidir o priorizar (no obvia).

**Impacto en negocio** — efecto en pipeline, conversión, margen, velocidad o riesgo reputacional; indicar si es dato o inferencia.

**Riesgo** — principal riesgo de inacción o de ejecutar mal.

**Oportunidad** — apuesta concreta de valor o ventana temporal.

**Acción recomendada** — lista numerada; cada ítem: verbo de acción + responsable sugerido + plazo.

**Ángulo neuroventa** — una frase breve para generar avance hacia siguiente paso (sin manipulación).

Sin introducciones de relleno; bullets densos; lenguaje orientado a decisión y crecimiento.`;

const genericNoRepeat = `No repetir listas genéricas (blog, SEO, publicar más, diversificar redes) salvo que estén atadas a una señal explícita del contexto. No reexplicar lo ya cubierto en otros módulos del mismo informe: este bloque aporta valor único. Diferenciar hechos del CRM de inferencias; marcar inferencias como [Hipótesis].`;

const oportunidades = {
  role_persona:
    "Actúa como director de crecimiento y growth marketing: priorización con criterio de negocio (motor MODO EASY V2.2).",
  context_environment:
    "MODO EASY V2.2: este módulo debe validar de forma obligatoria contra MEMORIA ACUMULADA y evitar redundancia.",
  objective:
    "Proponer oportunidades nuevas y una re-priorización justificada de hallazgos previos, sin duplicar tácticas ya cubiertas.",
  specific_task: `Antes de responder, validá cada propuesta contra **MEMORIA ACUMULADA**:
- Si ya existe en memoria, NO puede entrar como nueva oportunidad.
- Solo puede aparecer en bloque de re-priorización con evidencia nueva y motivo de cambio de prioridad.

Estructura obligatoria:
1) **Nuevas oportunidades (net-new)**: 3 a 6 ítems no presentes en memoria. Cada ítem: señal nueva, impacto, esfuerzo, riesgo.
2) **Re-priorización de hallazgos previos**: 0 a 3 ítems. Cada ítem: hallazgo previo, qué cambió, por qué sube prioridad ahora.

Prohibido repetir diagnóstico de Investigación Digital, Redes, FODA o Plan sin evidencia adicional.

${genericNoRepeat}`,
  constraints: `- Validación contra memoria obligatoria: si el ítem aparece en memoria y no trae evidencia nueva, excluirlo.
- Máximo total 9 ítems (sumando nuevos + re-priorización).
- No usar placeholders vagos tipo "mejorar redes/SEO/blog" sin señal concreta.
- ${genericNoRepeat}`,
  output_format: `${seniorBlocks}

Contrato V2.2 adicional:
- Incluir al final: **Chequeo anti-redundancia** con dos líneas:
  1) "Descartadas por repetición: <lista breve>"
  2) "Re-priorizadas con evidencia nueva: <lista breve>"`,
  target_audience: audience,
};

const cierre = {
  role_persona:
    "Actúa como closer de ventas consultivas y neuroventas: foco en avance, prueba y siguiente paso (motor MODO EASY V2.2).",
  context_environment:
    "MODO EASY V2.2: este análisis es sobre cómo nuestra organización cierra con este lead. Uso obligatorio de variables comerciales del perfil.",
  objective:
    "Diseñar un cierre comercial concreto, anclado a la oferta real configurada y evitando propuestas genéricas.",
  specific_task: `Usá explícitamente estas variables en el razonamiento y en la propuesta:
- Oferta principal: {{oferta_principal_nuestra_organizacion}}
- Tipo de organización vendedora: {{tipo_organizacion_vendedora}}

Regla V2.2:
- Si no podés anclar una recomendación a {{oferta_principal_nuestra_organizacion}}, NO la incluyas.
- Quedan invalidadas respuestas genéricas de "paquete de marketing/redes/SEO" sin vinculación explícita con la oferta principal.
- Prohibido inventar servicios, alcance o pricing no presentes en CRM/memoria.

Entregar: objetivo de cierre, estrategia de avance, guion breve, objeciones y siguiente paso calendarizado.

${genericNoRepeat}`,
  constraints: `- Debe aparecer al menos 3 veces el texto {{oferta_principal_nuestra_organizacion}} o su sustitución efectiva en el contenido final.
- Si la variable no está resuelta, escribir una alerta de configuración y no inventar oferta alternativa.
- "Nosotros" = {{tipo_organizacion_vendedora}}, "ellos" = lead.
- Prohibido inventar paquetes genéricos sin evidencia.
- ${genericNoRepeat}`,
  output_format: `${seniorBlocks}

Contrato V2.2 adicional:
- Agregar bloque final **Anclaje comercial** con:
  - Oferta usada para cerrar
  - Prueba de encaje con el lead (3 bullets)
  - Próximo paso con fecha/plazo`,
  target_audience: audience,
};

const plan = {
  role_persona:
    "Actúa como PM de crecimiento orientado a ejecución comercial (motor MODO EASY V2.2).",
  context_environment:
    "MODO EASY V2.2: plan operativo rígido, sin diagnóstico. Si hay memoria acumulada, solo usarla para priorizar ejecución.",
  objective:
    "Construir un plan 7/30/90 totalmente accionable con responsables y KPI por acción.",
  specific_task: `Estructura rígida obligatoria:
- **Roadmap 7 días**
- **Roadmap 30 días**
- **Roadmap 90 días**

Cada bloque debe tener 3 a 5 acciones. Formato de cada acción:
Acción concreta | Responsable sugerido (rol) | KPI | Entregable

Prohibido diagnóstico en este módulo:
- No describir problemas de web/redes/mercado.
- No repetir hallazgos previos, salvo una línea de referencia cuando sea imprescindible.

${genericNoRepeat}`,
  constraints: `- Si falta alguno de los bloques 7/30/90, la respuesta es inválida.
- Si una acción no tiene KPI o responsable, la respuesta es inválida.
- Prohibido usar 48h/72h como reemplazo del bloque "7 días".
- Prohibido mezclar diagnóstico con ejecución.
- ${genericNoRepeat}`,
  output_format: `Usar exactamente este formato:

**Roadmap 7 días**
1) Acción | Responsable | KPI | Entregable
2) Acción | Responsable | KPI | Entregable
3) Acción | Responsable | KPI | Entregable

**Roadmap 30 días**
1) Acción | Responsable | KPI | Entregable
2) Acción | Responsable | KPI | Entregable
3) Acción | Responsable | KPI | Entregable

**Roadmap 90 días**
1) Acción | Responsable | KPI | Entregable
2) Acción | Responsable | KPI | Entregable
3) Acción | Responsable | KPI | Entregable

Cerrar con bloque **Control de ejecución** (3 riesgos de implementación + mitigación).`,
  target_audience: audience,
};

const vision = {
  role_persona:
    "Actúa como socio estratégico senior de crecimiento y decisión comercial (motor MODO EASY V2.2).",
  context_environment:
    "MODO EASY V2.2: este módulo sintetiza decisiones. Está prohibido repetir diagnóstico textual de módulos anteriores.",
  objective:
    "Convertir los outputs previos en decisiones estratégicas explícitas: qué hacer, qué NO hacer y qué priorizar primero.",
  specific_task: `Construí la visión con lógica decisional, no descriptiva.

Regla anti-repetición:
- No copiar ni parafrasear diagnóstico previo.
- Si citás un hallazgo previo, hacelo en una línea y transformalo en decisión concreta.

Debés entregar:
1) Decisión estratégica principal (1)
2) Decisiones de soporte (2-3)
3) Qué NO hacer ahora (2-3 exclusiones)
4) Apuesta prioritaria próxima (1)

${genericNoRepeat}`,
  constraints: `- Prohibido repetir listas tácticas de módulos previos.
- Cada sección debe terminar con una decisión accionable.
- Incluir trade-off explícito: qué se gana y qué se posterga.
- ${genericNoRepeat}`,
  output_format: `Usar exactamente estos títulos:

1) **DECISIÓN ESTRATÉGICA PRINCIPAL**
2) **DECISIONES DE SOPORTE**
3) **QUÉ NO HACER AHORA**
4) **APUESTA PRIORITARIA INMEDIATA**
5) **SEÑAL DE ÉXITO EN 30 DÍAS**

Cierre con bloque **Justificación breve** (máx. 5 líneas) sin re-describir diagnóstico.`,
  target_audience: audience,
};

function sqlEscapeDollarTag(s, tag) {
  if (s.includes(tag)) throw new Error(`Content contains closing tag ${tag}`);
  return s;
}

function updateBlock(id, tagInner, fields) {
  const tag = `$${tagInner}$`;
  const pc = buildPromptContent(fields);
  sqlEscapeDollarTag(pc, tag);
  sqlEscapeDollarTag(fields.role_persona, tag);
  sqlEscapeDollarTag(fields.context_environment, tag);
  sqlEscapeDollarTag(fields.objective, tag);
  sqlEscapeDollarTag(fields.specific_task, tag);
  sqlEscapeDollarTag(fields.constraints, tag);
  sqlEscapeDollarTag(fields.output_format, tag);
  sqlEscapeDollarTag(fields.target_audience, tag);

  return `UPDATE public.ai_prompts SET
  role_persona = ${tag}${fields.role_persona}${tag},
  context_environment = ${tag}${fields.context_environment}${tag},
  objective = ${tag}${fields.objective}${tag},
  specific_task = ${tag}${fields.specific_task}${tag},
  constraints = ${tag}${fields.constraints}${tag},
  output_format = ${tag}${fields.output_format}${tag},
  target_audience = ${tag}${fields.target_audience}${tag},
  prompt_content = ${tag}${pc}${tag},
  status = 'validated',
  updated_at = now()
WHERE id = '${id}';
`;
}

const header = `-- MODO EASY V2.2 — anti-redundancia y foco comercial (Oportunidades, Cierre, Plan, Visión)

`;

const sql =
  header +
  updateBlock("010d8b53-8458-4d1d-9003-f83d94f107c5", "v22o", oportunidades) +
  "\n" +
  updateBlock("80f36f16-1057-4173-be94-e9673b28655c", "v22c", cierre) +
  "\n" +
  updateBlock("206af245-73b6-43e0-ba10-56478a74cac3", "v22p", plan) +
  "\n" +
  updateBlock("eeedcf20-7707-46b3-83c2-e79f66ffd455", "v22v", vision);

const outPath = join(__dirname, "..", "migrations", "056_modo_easy_v22_prompts.sql");
writeFileSync(outPath, sql, "utf8");
console.log("Wrote", outPath);
