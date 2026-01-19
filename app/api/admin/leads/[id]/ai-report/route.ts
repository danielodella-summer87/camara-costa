import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

type LeadRow = {
  id: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;

  website?: string | null;
  objetivos?: string | any | null; // text (puede venir como array por backward compatibility)
  audiencia?: string | any | null; // text (puede venir como array por backward compatibility)
  tamano?: string | null;
  oferta?: string | null;

  ai_context?: string | null;
  ai_report?: string | null;
  ai_report_updated_at?: string | null;
  ai_custom_prompt?: string | null;
};

function safeId(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function extractUrls(text: string) {
  const m = text.match(/https?:\/\/[^\s)]+/gi);
  return m ? Array.from(new Set(m)) : [];
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Genera un informe técnico fallback cuando falla la IA
 */
function generateFallbackReport(lead: LeadRow): string {
  const nombre = lead.nombre ?? "Lead";
  const leadId = lead.id;
  const origen = lead.origen ?? "No especificado";
  const pipeline = lead.pipeline ?? "No especificado";
  const website = (lead.website ?? "").trim();
  const tamano = lead.tamano ?? "No especificado";
  // Soportar tanto string como array (backward compatibility)
  const objetivos = Array.isArray(lead.objetivos) 
    ? lead.objetivos.join(", ") 
    : (lead.objetivos ?? "").trim();
  const audiencia = Array.isArray(lead.audiencia) 
    ? lead.audiencia.join(", ") 
    : (lead.audiencia ?? "").trim();
  const oferta = (lead.oferta ?? "").trim();
  const notas = lead.notas ?? "";
  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `# Informe Técnico de Oportunidades — ${nombre}

Fecha: ${fecha}
Lead ID: ${leadId}

> ⚠️ **Nota:** La generación automática con IA no está disponible. Este es un informe técnico básico basado en los datos disponibles.

## Resumen ejecutivo (decisión)
- Completar información faltante en la ficha para habilitar diagnóstico completo (impacto: alto — permite identificar oportunidades reales)
- ${website ? `Validar rubro y propuesta de valor mediante análisis de ${website}` : "Solicitar website para validar rubro y propuesta de valor"} (impacto: alto — confirma fit con la Cámara)
- Mapear socios compatibles por objetivos y audiencia (impacto: medio — acelera networking efectivo)
- Definir métricas de éxito para la afiliación (impacto: medio — permite medir ROI)
- Agendar welcome call para validar expectativas y objetivos (impacto: alto — establece relación desde el inicio)

## Diagnóstico técnico

### Hechos confirmados
${objetivos ? `- Objetivos declarados: ${objetivos}` : "- No se especificaron objetivos"}
${audiencia ? `- Audiencia objetivo: ${audiencia}` : "- No se especificó audiencia"}
${website ? `- Website disponible: ${website}` : "- No se proporcionó website"}
${oferta ? `- Oferta a la Cámara: ${oferta}` : "- No se especificó oferta"}
- Pipeline: ${pipeline}
- Tamaño: ${tamano}
- Origen: ${origen}

### Hipótesis
- ${!objetivos ? "Falta definir objetivos claros de afiliación — limita identificación de oportunidades específicas" : "Objetivos identificados — requiere validación y priorización"}
- ${!audiencia ? "Falta definir audiencia objetivo — dificulta mapeo de socios compatibles" : "Audiencia definida — posible mapeo de socios con fit"}
- ${!website ? "Falta website — no se puede validar rubro ni propuesta de valor sin análisis" : "Website disponible — requiere análisis de contenido para inferir rubro y propuesta"}
- ${!oferta ? "Falta oferta específica — no se puede evaluar valor para la comunidad" : "Oferta definida — requiere validación de impacto y viabilidad"}

## Oportunidades priorizadas

| Prioridad | Oportunidad | Impacto | Evidencia/Señal | Primer paso | Métrica |
|-----------|-------------|---------|-----------------|-------------|---------|
| Alta | Completar información faltante | Alto — habilita diagnóstico completo | Campos vacíos en ficha | Solicitar datos faltantes al lead | % de campos completados |
| Alta | ${website ? `Validar rubro y propuesta mediante ${website}` : "Solicitar website para análisis"} | Alto — confirma fit estratégico | ${website ? "Website disponible" : "Website faltante"} | ${website ? `Revisar ${website}` : "Solicitar URL"} | Validación de rubro (sí/no) |
| Media | Mapear socios compatibles | Medio — acelera networking | Objetivos y audiencia ${audiencia ? "definidos" : "faltantes"} | Identificar 3-5 socios con fit | Número de socios mapeados |
| Media | Definir métricas de éxito | Medio — permite medir ROI | Objetivos ${objetivos ? "identificados" : "pendientes"} | Establecer KPIs con el lead | Métricas definidas (número) |
| Baja | Plan de contenido y visibilidad | Bajo — complementa estrategia | Oferta ${oferta ? "disponible" : "pendiente"} | Evaluar oportunidades de co-marketing | Acciones de contenido (número) |

## Acciones en 72 horas
- [ ] Validar información faltante en la ficha del lead
- [ ] ${website ? `Revisar website: ${website}` : "Solicitar website al lead"}
- [ ] Identificar 3-5 socios potenciales con fit por objetivos y audiencia
- [ ] Agendar welcome call inicial para validar expectativas
- [ ] Definir métricas de éxito preliminares

## Plan 30–90 días

### 30 días
- Onboarding completo del lead
- Validación de objetivos y priorización
- Primeras conexiones con 3-5 socios identificados
- Establecimiento de métricas base

### 60 días
- Activación de beneficios principales
- Seguimiento de métricas y ajuste de estrategia
- Segunda ronda de conexiones con socios
- Evaluación de impacto inicial

### 90 días
- Evaluación completa de impacto de la afiliación
- Planificación de próximos pasos y escalamiento
- Renovación o ajuste de estrategia según resultados
- Documentación de aprendizajes

## Riesgos y bloqueos
- **Información incompleta:** La ficha tiene campos faltantes que limitan el diagnóstico (mitigación: solicitar datos faltantes prioritarios)
- **Falta de contexto:** Sin website o información adicional, es difícil validar fit con la Cámara (mitigación: solicitar website y contexto adicional)
- **Objetivos no priorizados:** ${objetivos ? "Objetivos identificados pero requieren priorización" : "Falta definir objetivos"} (mitigación: welcome call para validar y priorizar)

## Datos faltantes
${!website ? "- ¿Cuál es el website de la empresa? (crítico para validar rubro y propuesta)" : ""}
${!objetivos ? "- ¿Cuáles son los objetivos principales de afiliación a la Cámara?" : ""}
${!audiencia ? "- ¿A qué audiencia le vende la empresa? (B2B, B2C, Gobierno, etc.)" : ""}
${!oferta ? "- ¿Qué ofrece específicamente a la Cámara/comunidad?" : ""}
${!notas ? "- ¿Hay notas adicionales o contexto relevante sobre el lead?" : ""}
${website && objetivos && audiencia && oferta ? "- Todos los campos principales están completos" : ""}

${website ? `## Hipótesis por website

⚠️ **Inferencias basadas en dominio, sin navegación ni análisis de contenido real**

- Dominio: ${website}
- Posible rubro: Inferir basado en dominio (requiere análisis de contenido)
- Propuesta de valor: Requiere revisión de contenido del sitio
- Audiencia objetivo: Validar con análisis de website
- Fit con Cámara: Requiere validación con información completa

*Nota: Estas son inferencias preliminares. Se requiere análisis real del contenido del website para confirmar.*` : ""}

---
*Informe generado automáticamente. Para un análisis más profundo, se requiere generación con IA.*
`;
}

/**
 * Genera un informe técnico usando OpenAI
 */
/**
 * Lee el prompt base desde la tabla config
 */
async function getPromptBase(): Promise<string> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("config")
      .select("value")
      .eq("key", "leads_ai_prompt_base")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned (ok si no existe)
      console.error("Error leyendo prompt base desde config:", error);
      return "";
    }

    return (data?.value ?? "").trim();
  } catch (e: any) {
    console.error("Error inesperado leyendo prompt base:", e);
    return "";
  }
}

async function generateAiReportAI(lead: LeadRow & { custom_prompt?: string | null }): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("OPENAI_API_KEY presente:", Boolean(process.env.OPENAI_API_KEY));
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  // Leer prompt base desde config
  const promptBase = await getPromptBase();

  const nombre = lead.nombre ?? "Lead";
  const leadId = lead.id;
  const origen = lead.origen ?? "No especificado";
  const pipeline = lead.pipeline ?? "No especificado";
  const website = (lead.website ?? "").trim();
  const tamano = lead.tamano ?? "No especificado";
  // Soportar tanto string como array (backward compatibility)
  const objetivos = Array.isArray(lead.objetivos) 
    ? lead.objetivos.join(", ") 
    : (lead.objetivos ?? "").trim();
  const audiencia = Array.isArray(lead.audiencia) 
    ? lead.audiencia.join(", ") 
    : (lead.audiencia ?? "").trim();
  const oferta = (lead.oferta ?? "").trim();
  const notas = lead.notas ?? "";
  const linkedinEmpresa = ""; // Campo no disponible en el schema actual
  const linkedinDirector = ""; // Campo no disponible en el schema actual
  const fecha = new Date().toLocaleDateString("es-UY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Prompt por defecto (si no hay prompt base configurado)
  const defaultPrompt = `Actuás como Director de Desarrollo Institucional y Membresías de una Cámara Comercial internacional.

Tu rol NO es marketing.
Tu rol es institucional–estratégico.

OBJETIVO DEL INFORME:
1) Evaluar si esta empresa es un BUEN CANDIDATO para ser socio de la Cámara.
2) Detectar fortalezas, prestigio, riesgos y encaje institucional.
3) Definir la MEJOR ESTRATEGIA para convertirlo en socio (argumentos, propuesta y próximos pasos).

Tono: profesional, ejecutivo, claro.
Estilo: punto medio entre institucional y comercial.
Enfoque: criterio, decisión y acción. Sin humo.

---

## FUENTES DE INFORMACIÓN DISPONIBLES
- Datos cargados en el CRM
- Website oficial del lead (análisis conceptual del contenido, propuesta y posicionamiento)
- Perfil de LinkedIn de la empresa
- Perfil de LinkedIn del director / decisor
⚠️ No realizar scraping técnico ni navegación profunda.
⚠️ Basarse en señales públicas típicas de estos canales.

---

## DATOS DEL LEAD (CRM)
- Empresa: ${nombre}
- Lead ID: ${leadId}
- Origen: ${origen}
- Pipeline: ${pipeline}
- Website: ${website || "No proporcionado"}
- Tamaño de empresa: ${tamano}
- Objetivos declarados: ${objetivos || "No especificados"}
- A quién le vende: ${audiencia || "No especificado"}
- Qué ofrece a la Cámara / comunidad: ${oferta || "No especificado"}
- Perfil LinkedIn Empresa: ${linkedinEmpresa || "No proporcionado"}
- Perfil LinkedIn Director / Decisor: ${linkedinDirector || "No proporcionado"}
- Notas internas: ${notas || "Sin notas"}

---

## FORMATO OBLIGATORIO (Markdown)

El informe DEBE comenzar exactamente así:

# Informe de Evaluación y Captación de Socio — ${nombre}

Fecha: ${fecha}  
Lead ID: ${leadId}

---

## 1) Resumen ejecutivo (decisión)
- 5 bullets exactos
- Cada bullet debe cerrar con una recomendación:
  [Avanzar] / [Validar] / [Descartar]
- Enfoque: decisión institucional, no marketing

---

## 2) Perfil institucional del lead (hechos confirmados)
- Rubro y tipo de empresa (según website y LinkedIn)
- Tamaño y nivel de madurez
- Tipo de audiencia a la que vende
- Posicionamiento público (institucional vs comercial)
⚠️ No inventar datos. Si algo no es claro, indicar "A confirmar".

---

## 3) Análisis de reputación y señales públicas
### Website
- Nivel de profesionalismo percibido
- Claridad de propuesta
- Enfoque local / regional / internacional

### LinkedIn Empresa
- Actividad (alta / media / baja)
- Tipo de contenido (institucional, comercial, técnico)
- Señales de crecimiento o estancamiento

### LinkedIn Director / Decisor
- Rol y seniority
- Perfil institucional vs comercial
- Señales de liderazgo, red y apertura a cámaras

---

## 4) FODA como potencial socio de la Cámara
### Fortalezas (para la Cámara)
### Oportunidades (para la red de socios)
### Debilidades (en relación a expectativas de Cámara)
### Riesgos / Alertas (reputación, fit, conflictos potenciales)

Regla:
- Si no hay evidencia suficiente → escribir "A confirmar".
- No suavizar riesgos.

---

## 5) Score de candidatura (priorización interna)
Asignar puntaje 0–5 y justificar:
- Prestigio / reputación percibida
- Fit institucional con la Cámara
- Potencial de aporte a la red
- Probabilidad de cierre como socio en 30 días

Luego indicar:
- Score final: X/5 (SIEMPRE usar formato X/5, NUNCA usar /10)
- Categoría: Prioridad Alta / Media / Baja

---

## 6) Oportunidades priorizadas para la Cámara (tabla)
Tabla Markdown con columnas EXACTAS:
| Prioridad | Oportunidad para la Cámara | Valor esperado | Señal/Evidencia | Primer paso | Métrica |

- Enfocadas en beneficio para la Cámara, no para el lead.

---

## 7) Estrategia recomendada de captación como socio
Debe incluir:
- Argumento central de valor institucional
- Qué tipo de membresía o vínculo proponer
- Qué beneficio destacar primero
- Qué error evitar en el acercamiento
- Perfil ideal del interlocutor

---

## 8) Plan de acción sugerido
### Acciones en 72 horas
Checklist concreto

### Estrategia 30–90 días
- 30 días: validación y acercamiento
- 60 días: involucramiento
- 90 días: cierre o descarte

---

## 9) Información a validar antes de avanzar
- Preguntas concretas que la Cámara debería confirmar
- Enfocadas en decisión institucional, no marketing

---

REGLAS ESTRICTAS:
- NO usar lenguaje de marketing.
- NO hablar de campañas, funnels o leads.
- El foco es: ¿conviene sumarlo como socio?, ¿por qué?, ¿cómo?
- No inventes información no respaldada por los datos.
- Si la información es insuficiente, indicarlo claramente.

Generá el informe completo siguiendo EXACTAMENTE este formato.`;

  // Construir prompt final combinando:
  // 1. Prompt base desde config (si existe)
  // 2. Prompt con datos del lead (defaultPrompt)
  // 3. Custom prompt del usuario (si existe)
  const promptParts: string[] = [];
  
  if (promptBase) {
    promptParts.push(promptBase.trim());
  }
  
  promptParts.push(defaultPrompt);
  
  // Agregar personalización del usuario SI existe
  if (lead.custom_prompt && lead.custom_prompt.trim()) {
    promptParts.push(`**INSTRUCCIONES ADICIONALES DEL USUARIO:**\n${lead.custom_prompt.trim()}`);
  }
  
  const promptFinal = promptParts.join("\n\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres un consultor senior experto en identificar oportunidades estratégicas para Cámaras de Comercio. Generas informes técnicos de oportunidades con enfoque en decisiones, hipótesis accionables, señales y riesgos. Tono directo, sin relleno, consultivo senior.",
          },
          {
            role: "user",
            content: promptFinal,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    console.log("OpenAI response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${errorData?.error?.message || "Unknown error"}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    console.log(
      "OpenAI content preview:",
      data?.choices?.[0]?.message?.content?.slice(0, 300)
    );

    const aiText = data?.choices?.[0]?.message?.content?.trim() ?? "";

    if (!aiText) {
      throw new Error("OpenAI no devolvió contenido");
    }

    // Log para debugging (solo en consola, no en el informe)
    if (lead.custom_prompt && lead.custom_prompt.trim()) {
      console.log("✅ Se aplicó personalización adicional al informe IA");
    }

    // Agregar línea discreta al inicio del informe SOLO si hay personalización
    // (sin mostrar el contenido por privacidad)
    const hasCustomization = !!(lead.custom_prompt && lead.custom_prompt.trim());
    const finalReport = hasCustomization
      ? `*Se aplicó personalización adicional: Sí*\n\n${aiText}`
      : aiText;

    return finalReport;
  } catch (error: any) {
    throw new Error(`Error generando informe con IA: ${error?.message ?? "Unknown error"}`);
  }
}

/**
 * GET: devuelve ai_context + ai_report del lead (si existe)
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;
    const id = safeId(rawId);

    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    const { data, error } = await sb
      .from("leads")
      .select(
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    const row = (data ?? null) as LeadRow | null;
    return NextResponse.json(
      {
        data: row
          ? {
              id: row.id,
              ai_context: row.ai_context ?? null,
              report: row.ai_report ?? null,
              ai_report: row.ai_report ?? null,
              ai_report_updated_at: row.ai_report_updated_at ?? null,
            }
          : null,
        error: null,
      } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}

/**
 * POST: genera informe técnico con IA y guarda ai_context + ai_report en el lead
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;
    const id = safeId(rawId);

    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    // Body opcional: puede incluir custom_prompt y force_regenerate
    const body = (await req.json().catch(() => null)) as
      | {
          custom_prompt?: string | null;
          force_regenerate?: boolean;
        }
      | null;

    const shouldRegenerate = body?.force_regenerate === true;
    
    // Fuente de verdad: prioridad 1) body.custom_prompt, 2) lead.ai_custom_prompt, 3) null
    const bodyCustomPrompt = typeof body?.custom_prompt === "string" ? body.custom_prompt.trim() : null;
    
    // Log para debugging (antes de leer el lead)
    console.log("AI REPORT leadId=", id, "body_custom_prompt_len=", bodyCustomPrompt?.length ?? 0, "force=", shouldRegenerate);

    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .select(
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_custom_prompt"
      )
      .eq("id", id)
      .maybeSingle();

    if (leadErr) throw leadErr;
    if (!lead) {
      return NextResponse.json({ data: null, error: "Lead no encontrado" } satisfies ApiResp<null>, { status: 404 });
    }

    const leadRow = lead as LeadRow;

    // Determinar custom_prompt final: prioridad 1) body, 2) lead.ai_custom_prompt, 3) null
    const finalCustomPrompt = bodyCustomPrompt || (leadRow.ai_custom_prompt?.trim() || null);
    
    // Log solo valores primitivos (no objetos complejos para evitar circular JSON)
    console.log("📥 POST /ai-report recibido:", {
      leadId: id,
      force_regenerate: shouldRegenerate,
      body_custom_prompt_length: bodyCustomPrompt?.length || 0,
      db_custom_prompt_length: leadRow.ai_custom_prompt?.trim().length || 0,
      final_custom_prompt_length: finalCustomPrompt?.length || 0,
      has_existing_report: !!(leadRow.ai_report && leadRow.ai_report.trim()),
    });

    // Verificar si ya existe un informe
    const hasExistingReport = !!(leadRow.ai_report && leadRow.ai_report.trim());

    // Log campos del lead recién leído (solo en dev)
    if (process.env.NODE_ENV === "development") {
      console.log("📋 Lead data (fresh from DB):", {
        website: leadRow.website,
        objetivos: leadRow.objetivos,
        audiencia: leadRow.audiencia,
        tamano: leadRow.tamano,
        oferta: leadRow.oferta,
        notas: leadRow.notas,
      });
    }

    // Decisión: reutilizar informe existente o generar uno nuevo
    if (!shouldRegenerate && hasExistingReport) {
      console.log("✅ Reutilizando informe existente (regenerate=false, hay informe previo)");
      const row = leadRow as LeadRow;
      return NextResponse.json(
        {
          data: {
            id: row.id,
            ai_context: row.ai_context ?? null,
            report: row.ai_report ?? null,
            ai_report: row.ai_report ?? null,
            ai_report_updated_at: row.ai_report_updated_at ?? null,
          },
          error: null,
        } satisfies ApiResp<any>,
        { status: 200 }
      );
    }

    console.log(shouldRegenerate 
      ? "🔄 FORCE REGENERATE: generando nuevo informe (force_regenerate=true)" 
      : "🆕 Generando nuevo informe (no hay informe previo)");

    // Generar informe con IA, con fallback si falla
    let report: string;
    let aiContext: string;

    try {
      // Pasar custom_prompt final (prioridad: body > DB > null) a generateAiReportAI
      report = await generateAiReportAI({
        ...leadRow,
        ai_context: leadRow.ai_context || null,
        custom_prompt: finalCustomPrompt, // Personalización: body > DB > null
      });
      // Construir contexto para guardar
      aiContext = [
        `Nombre: ${leadRow.nombre ?? "Lead"}`,
        `Origen: ${leadRow.origen ?? "—"}`,
        `Pipeline: ${leadRow.pipeline ?? "—"}`,
        `Website: ${leadRow.website ?? "—"}`,
        `Tamaño: ${leadRow.tamano ?? "—"}`,
        `Objetivos: ${Array.isArray(leadRow.objetivos) ? leadRow.objetivos.join(", ") : "—"}`,
        `Audiencia: ${Array.isArray(leadRow.audiencia) ? leadRow.audiencia.join(", ") : "—"}`,
        `Oferta: ${leadRow.oferta ?? "—"}`,
        `Notas: ${leadRow.notas ?? "—"}`,
        `Generado con IA: ${new Date().toISOString()}`,
      ].join("\n");
    } catch (error: any) {
      // Fallback: generar informe técnico básico
      report = generateFallbackReport({
        ...leadRow,
        ai_context: leadRow.ai_context || null,
      });
      aiContext = [
        `Nombre: ${leadRow.nombre ?? "Lead"}`,
        `Origen: ${leadRow.origen ?? "—"}`,
        `Pipeline: ${leadRow.pipeline ?? "—"}`,
        `Website: ${leadRow.website ?? "—"}`,
        `Tamaño: ${leadRow.tamano ?? "—"}`,
        `Objetivos: ${Array.isArray(leadRow.objetivos) ? leadRow.objetivos.join(", ") : "—"}`,
        `Audiencia: ${Array.isArray(leadRow.audiencia) ? leadRow.audiencia.join(", ") : "—"}`,
        `Oferta: ${leadRow.oferta ?? "—"}`,
        `Notas: ${leadRow.notas ?? "—"}`,
        `Error IA: ${error?.message ?? "Unknown error"}`,
        `Generado con fallback: ${new Date().toISOString()}`,
      ].join("\n");
    }

    // Función para normalizar score (blindar contra valores inválidos)
    // Asegura que siempre sea un entero entre 0-5 o null
    function normalizeScore(raw: unknown): number | null {
      if (raw === null || raw === undefined) return null;
      
      const n = Number(raw);
      if (Number.isNaN(n) || !isFinite(n)) return null;
      
      // Forzar a entero y clamp a 0-5
      const clamped = Math.max(0, Math.min(5, Math.round(n)));
      
      // Verificación final: debe ser entero entre 0-5
      if (!Number.isInteger(clamped) || clamped < 0 || clamped > 5) {
        return null;
      }
      
      return clamped;
    }

    // Extraer score y categoría del informe IA
    // ⚠️ Si no puede parsearse, NO fallar: dejar score = null y score_categoria = null
    let extractedScore: number | null = null;
    let extractedCategoria: string | null = null;

    try {
      // Buscar patrón: "Score final: X/5" o "Score final: X/10" o "Score final (promedio): X"
      // Aceptar ambos formatos: X/5 y X/10
      const scoreMatch5 = report.match(/Score\s+final[:\s]+(\d+)\s*\/\s*5/i);
      const scoreMatch10 = report.match(/Score\s+final[:\s]+(\d+)\s*\/\s*10/i);
      
      let scoreValue: number | null = null;
      let scale: "5" | "10" | null = null;
      
      if (scoreMatch5 && scoreMatch5[1]) {
        // Formato X/5: usar directamente
        scoreValue = parseInt(scoreMatch5[1], 10);
        scale = "5";
      } else if (scoreMatch10 && scoreMatch10[1]) {
        // Formato X/10: convertir a escala 0-5
        const value10 = parseInt(scoreMatch10[1], 10);
        // Convertir X/10 a 0-5: Math.round((X/10)*5) o Math.round(X/2)
        scoreValue = Math.round(value10 / 2);
        scale = "10";
      }
      
      if (scoreValue !== null && !isNaN(scoreValue) && isFinite(scoreValue) && Number.isInteger(scoreValue)) {
        // Aplicar clamp: Math.max(0, Math.min(5, score))
        const clamped = Math.max(0, Math.min(5, scoreValue));
        // Usar normalizeScore para validación final (asegura entero 0-5)
        extractedScore = normalizeScore(clamped);
        
        if (extractedScore !== null) {
          console.log(`✅ Score parseado: ${scoreValue}${scale === "10" ? "/10" : "/5"} → ${extractedScore}/5`);
        }
      }
    } catch (e) {
      // Si falla el parseo, dejar score = null (no fallar)
      console.warn("⚠️ No se pudo extraer score del informe IA:", e);
      extractedScore = null;
    }

    try {
      // Buscar patrón: "Categoría: X" (hasta fin de línea)
      const categoriaMatch = report.match(/Categoría[:\s]+([^\n\r]+)/i);
      if (categoriaMatch && categoriaMatch[1]) {
        extractedCategoria = categoriaMatch[1].trim();
        // Limpiar texto común
        extractedCategoria = extractedCategoria.replace(/^(Prioridad\s+)?/i, "").trim();
        if (extractedCategoria.length === 0) extractedCategoria = null;
      }
    } catch (e) {
      // Si falla el parseo, dejar categoría = null (no fallar)
      console.warn("⚠️ No se pudo extraer categoría del informe IA:", e);
      extractedCategoria = null;
    }

    // Normalizar score antes de guardar (blindar contra valores inválidos)
    // Asegurar que sea un entero válido (0-5) o null
    const normalizedScore = normalizeScore(extractedScore);
    
    // Verificación final: score debe ser entero entre 0-5 o null
    // Si no se puede parsear, NO actualizar score (dejarlo null)
    const finalScore = (normalizedScore !== null && 
                       Number.isInteger(normalizedScore) && 
                       normalizedScore >= 0 && 
                       normalizedScore <= 5) 
                      ? normalizedScore 
                      : null;

    // Log de control antes de guardar
    console.log("AI_SCORE_SAVE", { 
      score: finalScore, 
      categoria: extractedCategoria,
      extractedScore,
      normalizedScore,
      isInteger: finalScore !== null ? Number.isInteger(finalScore) : null,
      inRange: finalScore !== null ? (finalScore >= 0 && finalScore <= 5) : null
    });

    const patch: any = {
      ai_context: aiContext,
      ai_report: report, // report ya incluye la marca de debug (agregada en generateAiReportAI)
      ai_report_updated_at: nowIso(),
      updated_at: nowIso(),
      // Solo actualizar score si es válido (entero 0-5) o null
      // Si no se puede parsear, NO actualizar score (dejarlo null) y NO tirar error
      // Separar score y score_categoria para que puedan actualizarse independientemente
      score: finalScore,
      score_categoria: extractedCategoria,
    };

    const { data: updated, error: upErr } = await sb.from("leads").update(patch).eq("id", id).select("*").maybeSingle();
    if (upErr) throw upErr;

    const row = (updated ?? null) as LeadRow | null;

    // Asegurar que siempre retornamos data.report con contenido (incluye marca de debug)
    const finalReport = row?.ai_report ?? report;

    return NextResponse.json(
      {
        data: row
          ? {
              id: row.id,
              ai_context: row.ai_context ?? null,
              report: finalReport,
              ai_report: row.ai_report ?? null,
              ai_report_updated_at: row.ai_report_updated_at ?? null,
            }
          : {
              id: id,
              ai_context: aiContext,
              report: finalReport,
              ai_report: finalReport,
              ai_report_updated_at: nowIso(),
            },
        error: null,
      } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}