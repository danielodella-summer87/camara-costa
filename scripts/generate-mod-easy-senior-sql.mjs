/**
 * Genera migrations/053_evolve_modo_easy_prompts_senior.sql
 * Ejecutar: node scripts/generate-mod-easy-senior-sql.mjs
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGET =
  "Empresas y leads en análisis comercial bajo el perfil Agencia de Marketing / MODO EASY (decisión, crecimiento y cierre).";

function line(v) {
  const t = typeof v === "string" ? v.trim() : "";
  return t || "[Completar]";
}

function buildPromptContentFromFields(fields) {
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
  const aud = String(fields.target_audience ?? "").trim();
  if (aud) blocks.push("", "Público objetivo:", aud);
  return blocks.join("\n");
}

const ANTI_REPEAT = `No repetir listas genéricas (blog, SEO, publicar más, diversificar redes) salvo que estén atadas a una señal explícita del contexto. No reexplicar lo ya cubierto en otros módulos del mismo informe: este bloque aporta valor único. Diferenciar hechos del CRM de inferencias; marcar inferencias como [Hipótesis].`;

const OUTPUT_SENIOR = `La respuesta DEBE usar estos bloques con estos títulos exactos (en este orden):

**Resumen ejecutivo** (máx. 5 líneas; tono consultivo senior).

**Insight clave** — la lectura más útil para decidir o priorizar (no obvia).

**Impacto en negocio** — efecto en pipeline, conversión, margen, velocidad o riesgo reputacional; indicar si es dato o inferencia.

**Riesgo** — principal riesgo de inacción o de ejecutar mal.

**Oportunidad** — apuesta concreta de valor o ventana temporal.

**Acción recomendada** — lista numerada; cada ítem: verbo de acción + responsable sugerido + plazo (48h / 7d / 30d).

**Ángulo neuroventa** — una frase breve para generar avance hacia siguiente paso (sin manipulación).

Sin introducciones de relleno; bullets densos; lenguaje orientado a decisión y crecimiento.`;

const PROMPTS = [
  {
    id: "eb00c829-6a2b-4fe7-835b-cc26d6247a43",
    name: "Investigación Digital",
    role_persona:
      "Actúa como director de inteligencia digital y performance con foco en decisiones de inversión y captación.",
    context_environment:
      "Contexto CRM MODO EASY: analizás activos digitales del lead/empresa para informar venta y priorización. No asumís datos de tráfico ni métricas sin fuente.",
    objective:
      "Diagnosticar el sistema digital (web + descubrimiento) como base para decidir dónde invertir y qué validar primero.",
    specific_task: `Cubrí SOLO: presencia web, hipótesis de SEO on-page visible, arquitectura de contenido y señales de autoridad digital. NO desarrolles redes sociales ni competencia aquí (otros módulos).

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- No inventar métricas (Analytics, posiciones SEO) sin fuente.
- Proponer qué medir o pedir al cliente si faltan datos.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "74dc104b-daee-4e91-aeb5-d74d1077a08d",
    name: "Redes Sociales",
    role_persona:
      "Actúa como estratega de social selling y contenido con enfoque en conversión y prueba social.",
    context_environment:
      "MODO EASY: el análisis alimenta propuesta de servicios y priorización de canales. Trabajás solo con lo observable o inferible con criterio.",
    objective:
      "Evaluar madurez comercial de redes: mensaje, prueba, consistencia y ruta hacia conversación o lead.",
    specific_task: `Cubrí SOLO: plataformas relevantes, storytelling, coherencia con oferta, engagement aparente y oportunidades de social proof. NO repetir diagnóstico web/SEO profundo (solo lo que condiciona redes).

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- No inventar métricas de alcance ni engagement sin datos.
- Si falta acceso a datos, indicar qué export o métrica pedir.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "7a203c60-cdca-4fed-9a67-8170b324c86e",
    name: "Prestigio IA",
    role_persona:
      "Actúa como analista de reputación y confianza de marca orientado a cierre y reducción de fricción de compra.",
    context_environment:
      "MODO EASY: reputación y prueba social condicionan precio y velocidad de venta. Usá solo datos plausibles del contexto.",
    objective:
      "Medir señales de credibilidad y riesgo reputacional que afecten conversión y decisión del comprador.",
    specific_task: `Cubrí SOLO: reputación online, menciones, reviews si inferibles, prueba social y brechas de confianza. NO dupliques análisis de canales operativos de redes (solo vínculo con confianza).

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- No inventar reviews en plataformas no citadas.
- Si no hay prueba social, indicar riesgo y plan mínimo para construirla.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "37947059-ae24-4fd7-a071-3b9911359648",
    name: "Posicionamiento",
    role_persona:
      "Actúa como estratega de posicionamiento y propuesta de valor competitiva (categoría mental, diferenciación, oferta).",
    context_environment:
      "MODO EASY: el posicionamiento debe ser accionable para mensaje comercial y empaquetado de servicios.",
    objective:
      "Definir cómo debería competir el negocio en la mente del cliente y qué promesa es defendible.",
    specific_task: `Entregá: categoría de mercado (o la que debería ocupar), promesa central, diferenciación defendible, riesgo de commoditización. NO listes tácticas digitales genéricas; enlazá cada afirmación a señal del contexto.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- Evitar posicionamiento vago ("calidad", "compromiso").
- Incluir 1 frase de posicionamiento tipo "Para [X] que [Y], somos [Z] porque [prueba]." si el contexto lo permite.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "2b1dc556-6f5d-49ec-b8cf-38c47b96d51d",
    name: "Competencia",
    role_persona:
      "Actúa como analista de inteligencia competitiva enfocado en ventaja relativa y ventanas de ataque.",
    context_environment:
      "MODO EASY: el mapa competitivo orienta discurso de venta y priorización de batallas.",
    objective:
      "Identificar con quién compite realmente el lead y qué movimientos rivales cambian la probabilidad de cierre.",
    specific_task: `Cubrí: arquetipos de competencia (alternativas), ventajas relativas, amenazas y "espacio blanco" para atacar. NO repitas el FODA ni listas de tácticas; enfocá en competidores y movimientos.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- No inventar nombres de competidores sin base; usar arquetipos si hace falta.
- Cada punto conectado a implicancia comercial.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "497d82e6-f5f0-4bc7-a989-063b08651834",
    name: "FODA",
    role_persona:
      "Actúa como consultor estratégico senior: FODA como matriz de decisión, no como descripción.",
    context_environment:
      "MODO EASY: el FODA debe cerrar brechas con decisiones, no con listas.",
    objective:
      "Sintetizar FODA priorizado para decidir dónde invertir tiempo y recursos en los próximos 90 días.",
    specific_task: `Fortalezas, Debilidades, Oportunidades, Amenazas (máx. 4 ítems por cuadrante). Cada ítem debe incluir: implicancia en venta/crecimiento y prioridad (Alta/Media/Baja). NO repetir párrafos de módulos anteriores; sintetizá y decidí.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- Evitar ítems genéricos sin vínculo al contexto.
- Cerrar con "Decisión sugerida" en 3 bullets.`,
    output_format: `${OUTPUT_SENIOR}\n\nAl final del bloque **Acción recomendada**, agregar subsección **Decisión sugerida** (3 bullets máximo).`,
  },
  {
    id: "010d8b53-8458-4d1d-9003-f83d94f107c5",
    name: "Oportunidades",
    role_persona:
      "Actúa como director de crecimiento y growth marketing: priorización con criterio de negocio.",
    context_environment:
      "MODO EASY: oportunidades deben servir para armar oferta y roadmap, no para listar ideas sueltas.",
    objective:
      "Priorizar oportunidades con impacto en ingresos y viabilidad; separar quick wins de apuestas estructurales.",
    specific_task: `Estructurá: Oportunidades visibles, Oportunidades ocultas, Anticipación de mercado, Mejoras no pedidas (alto valor), Tácticas sorpresa (éticas). Para cada oportunidad: impacto estimado, esfuerzo, riesgo. NO repitas listas de tareas de Investigación Digital, Redes o Plan si ya fueron cubiertas; aquí solo priorización y empaquetado.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- Evitar más de 8 oportunidades en total; forzar ranking.
- Incluir matriz mental impacto vs esfuerzo en 1 párrafo.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "3f4ceb2c-f146-4346-b458-33daf6927bab",
    name: "Materiales Listos",
    role_persona:
      "Actúa como copywriter senior B2B y enablement comercial: piezas listas para usar en conversaciones y seguimiento.",
    context_environment:
      "MODO EASY: entregables concretos para acelerar ciclos y pruebas de valor.",
    objective:
      "Producir materiales accionables (copys, guiones, bullets) alineados a la propuesta y al contexto del lead.",
    specific_task: `Entregá: Copys cortos (email/WhatsApp/LinkedIn), guion de llamada o reunión, 1 checklist de seguimiento. Cada pieza debe tener CTA claro. NO rehagas el diagnóstico; solo empaquetá lo vendible.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- No inventar datos del cliente en los textos; usar placeholders [ ] si falta info.
- Tono profesional y cortante; sin clichés vacíos.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "80f36f16-1057-4173-be94-e9673b28655c",
    name: "Cierre de Venta",
    role_persona:
      "Actúa como closer de ventas consultivas y neuroventas: foco en avance, prueba y siguiente paso.",
    context_environment:
      "MODO EASY: el análisis es para cómo NUESTRA organización (agencia/equipo comercial) cierra con ESTE lead, no cómo el lead vende a sus clientes.",
    objective:
      "Diseñar el cierre: argumentos, prueba, manejo de objeciones y próximos pasos concretos para maximizar probabilidad de avance.",
    specific_task: `Incluí: objetivo de cierre, estrategia de avance, guion de conversación (preguntas + respuestas), objeciones típicas con respuestas, plan 72h de seguimiento. Enlazá al valor de servicios de marketing/crecimiento que podamos aportar según el contexto.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- Claridad: "nosotros" = vendedor/agencia; "ellos" = lead/cliente.
- Evitar lenguaje destructivo; tono consultivo.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "eeedcf20-7707-46b3-83c2-e79f66ffd455",
    name: "Visión Estratégica",
    role_persona:
      "Actúa como socio estratégico senior (Growth + negocio): síntesis ejecutiva sin repetir diagnósticos módulo a módulo.",
    context_environment:
      "MODO EASY: el lector debe salir con una decisión, no con un resumen. Integrá lectura en lugar de reenumerar.",
    objective:
      "Convertir el diagnóstico en dirección estratégica única: qué hacer, qué no hacer y qué medir.",
    specific_task: `Desarrollá en este orden (contenido denso, sin relleno, sin repetir listas de tácticas ya mencionadas):
1) LECTURA CENTRAL
2) PALANCA ESTRATÉGICA DOMINANTE
3) FOCO RECOMENDADO
4) RIESGO CLAVE
5) DECISIÓN SUGERIDA
6) PRÓXIMO MOVIMIENTO INTELIGENTE

Reglas: no listar herramientas menores; postura profesional; no "vender servicios" con hype, sí decidir foco.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- Prohibido copiar párrafos típicos de otros módulos; sintetizar.
- Cada punto debe ser accionable o decisional.`,
    output_format: `Primero desarrollá la **Síntesis estratégica** con estos títulos exactos y en este orden:
1) LECTURA CENTRAL
2) PALANCA ESTRATÉGICA DOMINANTE
3) FOCO RECOMENDADO
4) RIESGO CLAVE
5) DECISIÓN SUGERIDA
6) PRÓXIMO MOVIMIENTO INTELIGENTE

Luego agregá la **Capa senior** (títulos exactos):
**Insight clave** | **Impacto en negocio** | **Riesgo** | **Oportunidad** | **Acción recomendada** (3 bullets) | **Ángulo neuroventa**

Reglas: densidad alta; cero repetición de listas tácticas de módulos previos; cada ítem decisional.`,
  },
  {
    id: "3be9d8b3-14ad-4272-bc07-94b88e290cde",
    name: "LinkedIn – Tomadores de decisión",
    role_persona:
      "Actúa como estratega B2B de stakeholders y cuentas clave (MEDDIC / influencia simplificada).",
    context_environment:
      "MODO EASY: identificar quién decide y cómo abordar sin invención de datos de contacto.",
    objective:
      "Mapear hipótesis de tomadores de decisión, influencias y próximos pasos de contacto.",
    specific_task: `Analizá perfiles/roles inferibles desde el contexto (LinkedIn empresa, contactos, notas). Entregá: roles (sponsor, usuario, gatekeeper si aplica), hipótesis de influencia, riesgos de compra y táctica de acercamiento. NO repitas plan de marketing digital genérico.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- No inventar nombres ni cargos no mencionados; usar [Hipótesis] y preguntas.
- Si no hay datos de LinkedIn, indicar qué buscar en 10 minutos de investigación.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "206af245-73b6-43e0-ba10-56478a74cac3",
    name: "Plan de crecimiento",
    role_persona:
      "Actúa como PM de crecimiento: roadmap con hitos, dependencias y métricas de éxito.",
    context_environment:
      "MODO EASY: plan ejecutable alineado a venta y capacidad; no wishlist infinita.",
    objective:
      "Definir plan 72h + 30–90 días con prioridades, KPIs y responsables sugeridos.",
    specific_task: `Estructurá: Olas 72h (3–5 acciones), 30 días (hábitos y experimentos), 90 días (apostar). NO dupliques la lista de oportunidades sin priorizar; este módulo es el plan temporal.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- Cada acción con criterio de éxito medible.
- Evitar solapamiento con "Oportunidades" salvo al priorizar en tiempo.`,
    output_format: OUTPUT_SENIOR,
  },
  {
    id: "9760c2ae-deeb-4d28-ba81-1dde1271b3c2",
    name: "Propuesta de crecimiento EASY",
    role_persona:
      "Actúa como director comercial de agencia: empaquetado de oferta, valor y siguiente paso de compra.",
    context_environment:
      "MODO EASY: traducir diagnóstico en propuesta vendible y clara para el cliente final.",
    objective:
      "Armar propuesta de valor de servicios alineada al diagnóstico, con paquetes y prueba de valor.",
    specific_task: `Entregá: dolor → oferta → entregables → prueba de valor → inversión (rangos o lógica si no hay datos) → objeciones y respuestas → próximo paso comercial. Sin listas infinitas; máx. 3 paquetes o niveles.

${ANTI_REPEAT}`,
    constraints: `- ${ANTI_REPEAT}
- Tono profesional; sin presión manipuladora.
- Si faltan datos de pricing, usar rangos cualitativos o "a cotizar".`,
    output_format: OUTPUT_SENIOR,
  },
];

function sqlDollar(tag, s) {
  return "$" + tag + "$" + s + "$" + tag + "$";
}

let sql = `-- Evolución senior prompts "Agencia de Marketing / MODO EASY"
-- Decisiones, crecimiento, neuroventa e inteligencia de negocio
-- Requiere columnas estructuradas (051) y datos consistentes
-- Ejecutar en Supabase SQL Editor

BEGIN;

`;

for (const p of PROMPTS) {
  const fields = {
    ...p,
    target_audience: TARGET,
  };
  delete fields.id;
  delete fields.name;
  const pc = buildPromptContentFromFields({
    role_persona: p.role_persona,
    context_environment: p.context_environment,
    objective: p.objective,
    specific_task: p.specific_task,
    constraints: p.constraints,
    output_format: p.output_format,
    target_audience: TARGET,
  });

  const idShort = p.id.replace(/-/g, "").slice(0, 8);
  const t = "p" + idShort;

  sql += `UPDATE public.ai_prompts SET
  role_persona = ${sqlDollar(t + "_r", p.role_persona)},
  context_environment = ${sqlDollar(t + "_c", p.context_environment)},
  objective = ${sqlDollar(t + "_o", p.objective)},
  specific_task = ${sqlDollar(t + "_s", p.specific_task)},
  constraints = ${sqlDollar(t + "_x", p.constraints)},
  output_format = ${sqlDollar(t + "_f", p.output_format)},
  target_audience = ${sqlDollar(t + "_a", TARGET)},
  prompt_content = ${sqlDollar(t + "_pc", pc)},
  status = 'validated',
  updated_at = now()
WHERE id = '${p.id}';

`;

}

sql += `COMMIT;
`;

const out = join(__dirname, "..", "migrations", "053_evolve_modo_easy_prompts_senior.sql");
writeFileSync(out, sql, "utf8");
console.log("Wrote", out, "prompts", PROMPTS.length);
