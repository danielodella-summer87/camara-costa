/**
 * Genera migrations/055_modo_easy_v21_prompts.sql con prompt_content alineado a campos estructurados.
 * Uso: node scripts/gen-mod-easy-v21-migration.mjs
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
  if (audience) {
    blocks.push("", "Público objetivo:", audience);
  }
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

**Acción recomendada** — lista numerada; cada ítem: verbo de acción + responsable sugerido + plazo (48h / 7d / 30d).

**Ángulo neuroventa** — una frase breve para generar avance hacia siguiente paso (sin manipulación).

Sin introducciones de relleno; bullets densos; lenguaje orientado a decisión y crecimiento.`;

const genericNoRepeat = `No repetir listas genéricas (blog, SEO, publicar más, diversificar redes) salvo que estén atadas a una señal explícita del contexto. No reexplicar lo ya cubierto en otros módulos del mismo informe: este bloque aporta valor único. Diferenciar hechos del CRM de inferencias; marcar inferencias como [Hipótesis].`;

const oportunidades = {
  role_persona:
    "Actúa como director de crecimiento y growth marketing: priorización con criterio de negocio (motor MODO EASY V2.1).",
  context_environment: `MODO EASY: oportunidades deben servir para armar oferta y roadmap, no para listar ideas sueltas. Si el mensaje de usuario incluye **MEMORIA ACUMULADA**, tratá lo allí resumido como ya cubierto en módulos previos: no re-listar esas tácticas salvo en el bloque permitido de re-priorización.`,
  objective:
    "Priorizar oportunidades con impacto en ingresos y viabilidad; separar quick wins de apuestas estructurales.",
  specific_task: `Estructurá: Oportunidades visibles, Oportunidades ocultas, Anticipación de mercado, Mejoras no pedidas (alto valor), Tácticas sorpresa (éticas). Para cada oportunidad: impacto estimado, esfuerzo, riesgo.

V2.1 — Anti-redundancia (obligatorio):
- Si existe **MEMORIA ACUMULADA** arriba, las tácticas o acciones ya mencionadas allí están "dichas": no las repitas como oportunidades nuevas.
- Solo permitido: (a) oportunidades nuevas con señal nueva explícita (CRM, contexto o evidencia que no estaba en memoria), o (b) un bloque titulado exactamente **Re-priorización de hallazgos previos** donde listes solo ítems ya conocidos y expliques por qué suben en prioridad ahora (evidencia nueva, ventana temporal o cambio de riesgo).
- Si repetís una táctica que aparece en MEMORIA ACUMULADA, debe estar únicamente dentro de **Re-priorización de hallazgos previos** y con justificación explícita de por qué sube la prioridad.

NO repitas listas de tareas de Investigación Digital, Redes o Plan si ya fueron cubiertas; aquí priorización y empaquetado.

${genericNoRepeat}`,
  constraints: `- ${genericNoRepeat}
- Evitar más de 8 oportunidades en total; forzar ranking.
- Incluir matriz mental impacto vs esfuerzo en 1 párrafo.
- Prohibido duplicar tácticas de MEMORIA ACUMULADA fuera de **Re-priorización de hallazgos previos**.`,
  output_format: seniorBlocks,
  target_audience: audience,
};

const cierre = {
  role_persona:
    "Actúa como closer de ventas consultivas y neuroventas: foco en avance, prueba y siguiente paso (motor MODO EASY V2.1).",
  context_environment: `MODO EASY: el análisis es para cómo NUESTRA organización cierra con ESTE lead, no cómo el lead vende a sus clientes. Usá exactamente estas variables (no inventes sustitutos): tipo de organización vendedora = {{tipo_organizacion_vendedora}}; oferta principal a alinear = {{oferta_principal_nuestra_organizacion}}.`,
  objective:
    "Diseñar el cierre: argumentos, prueba, manejo de objeciones y próximos pasos concretos para maximizar probabilidad de avance, anclados a las variables de oferta y tipo de organización (sin asumir un paquete por defecto).",
  specific_task: `Incluí: objetivo de cierre, estrategia de avance, guion de conversación (preguntas + respuestas), objeciones típicas con respuestas, plan 72h de seguimiento. Enlazá el valor al encaje con {{oferta_principal_nuestra_organizacion}} como oferta principal de {{tipo_organizacion_vendedora}} — no sustituyas por otra oferta salvo que el CRM lo indique.

Prohibido asumir un paquete comercial por defecto ni inventar pricing. Si falta dato para cerrar, indicá la breve pregunta de aclaración en **Riesgo** o en **Acción recomendada** (1 línea).

${genericNoRepeat}`,
  constraints: `- ${genericNoRepeat}
- Claridad: "nosotros" = vendedor ({{tipo_organizacion_vendedora}}); "ellos" = lead/cliente.
- Evitar lenguaje destructivo; tono consultivo.
- No reemplazar {{oferta_principal_nuestra_organizacion}} ni {{tipo_organizacion_vendedora}} por texto genérico; si el sistema no las sustituyó, copiá los placeholders tal cual y pedí configuración en una línea.`,
  output_format: seniorBlocks,
  target_audience: audience,
};

const plan = {
  role_persona: "Actúa como PM de crecimiento: roadmap con hitos, dependencias y métricas de éxito (motor MODO EASY V2.1).",
  context_environment: `MODO EASY: plan ejecutable alineado a venta y capacidad; no wishlist infinita. Si hay **MEMORIA ACUMULADA**, úsala para calendarizar sin repetir el diagnóstico.`,
  objective:
    "Definir plan en 7 días / 30 días / 90 días con prioridades, KPIs y responsables sugeridos; sin repetir diagnóstico de módulos previos.",
  specific_task: `Este módulo es el plan temporal: traducí prioridades a calendario. Horizontes obligatorios y no intercambiables: **7 días**, **30 días**, **90 días** (no uses "72h" como sustituto del tramo de 7 días).

Para cada horizonte: 3–5 acciones concretas (verbo + resultado), responsable sugerido (rol, no nombre inventado), KPI o medida de éxito por acción.

PROHIBIDO reexplicar el diagnóstico de módulos anteriores (máx. 1 línea de remisión si una acción depende de un hallazgo previo). NO dupliques la lista de oportunidades sin calendarizar: aquí solo ejecución.

${genericNoRepeat}`,
  constraints: `- ${genericNoRepeat}
- Cada acción con criterio de éxito medible (KPI).
- Evitar solapamiento con "Oportunidades" salvo al bajar a tiempo, responsable y métrica.
- Los tres horizontes 7/30/90 son obligatorios; no omitir ninguno.`,
  output_format: `${seniorBlocks}

Contrato V2.1 (obligatorio al final, títulos exactos en este orden):

**Roadmap 7 días** — lista numerada; cada ítem: acción concreta | responsable sugerido (rol) | KPI
**Roadmap 30 días** — idem
**Roadmap 90 días** — idem

Prohibido repetir párrafos de diagnóstico en los roadmaps; solo acciones ejecutables.`,
  target_audience: audience,
};

function sqlEscapeDollarTag(s, tag) {
  if (s.includes(tag)) {
    throw new Error(`Content contains closing tag ${tag}`);
  }
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

const header = `-- MODO EASY V2.1 — Oportunidades, Cierre de Venta, Plan de crecimiento (campos estructurados + prompt_content alineados)

`;

const sql =
  header +
  updateBlock("010d8b53-8458-4d1d-9003-f83d94f107c5", "v21o", oportunidades) +
  "\n" +
  updateBlock("80f36f16-1057-4173-be94-e9673b28655c", "v21c", cierre) +
  "\n" +
  updateBlock("206af245-73b6-43e0-ba10-56478a74cac3", "v21p", plan);

const outPath = join(__dirname, "..", "migrations", "055_modo_easy_v21_prompts.sql");
writeFileSync(outPath, sql, "utf8");
console.log("Wrote", outPath);
