import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function isUuidLike(v: unknown) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
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
  ai_context?: string | null;
  ai_report?: string | null;
  ai_report_updated_at?: string | null;
};

function extractUrls(text: string) {
  const m = text.match(/https?:\/\/[^\s)]+/gi);
  return m ? Array.from(new Set(m)) : [];
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * ✅ Agente IA (DEMO) — determinístico, pero útil.
 * Luego lo reemplazamos por llamada real a LLM (OpenAI/etc).
 */
function generateAiReportDemo(lead: LeadRow) {
  const nombre = lead.nombre ?? "Lead";
  const origen = lead.origen ?? "—";
  const pipeline = lead.pipeline ?? "—";
  const email = lead.email ?? "—";
  const telefono = lead.telefono ?? "—";
  const notas = lead.notas ?? "";
  const ctx = lead.ai_context ?? "";
  const urls = extractUrls(`${notas}\n${ctx}`);

  const urlLine = urls.length ? urls.map((u) => `- ${u}`).join("\n") : "- (sin links por ahora)";

  // Heurística simple para “oportunidades” de cámara (demo)
  const opp = [
    "Introducciones con 3–5 socios relevantes (matching por rubro/interés).",
    "Visibilidad: directorio + newsletter + spotlight mensual (si aplica).",
    "Invitación a evento/comité específico para acelerar networking.",
    "Paquete de onboarding comercial: propuesta de valor, pitch y materiales.",
    "Agenda de 2 reuniones: (1) diagnóstico negocio, (2) plan 30 días.",
  ];

  return [
    `# Informe IA (demo) — ${nombre}`,
    ``,
    `**Fecha:** ${nowIso()}`,
    `**Origen:** ${origen}`,
    `**Pipeline:** ${pipeline}`,
    `**Contacto:** ${lead.contacto ?? "—"}`,
    `**Email:** ${email}`,
    `**Teléfono:** ${telefono}`,
    ``,
    `## Contexto y fuentes`,
    `**Links detectados:**`,
    `${urlLine}`,
    ``,
    `## FODA (demo)`,
    `**Fortalezas**`,
    `- (estimado) Propuesta clara para el mercado de UACOC / oportunidad de internacionalización.`,
    `- (estimado) Interés activo (ingresó como lead por: ${origen}).`,
    ``,
    `**Oportunidades**`,
    `- Networking dirigido con socios complementarios (joint ventures / referrals).`,
    `- Visibilidad en comunidad UACOC + eventos para acelerar pipeline.`,
    `- Optimización comercial: proceso, pitch y seguimiento.`,
    ``,
    `**Debilidades**`,
    `- Información pública / digital insuficiente o dispersa (si no hay links).`,
    `- Proceso comercial del lead puede estar inmaduro (a validar).`,
    ``,
    `**Amenazas**`,
    `- Competencia local con mayor presencia digital / pricing agresivo.`,
    `- Ciclos largos si no se define “próximo paso” y responsables.`,
    ``,
    `## Oportunidades concretas para UACOC (qué le aportamos)`,
    ...opp.map((x) => `- ${x}`),
    ``,
    `## Próximos pasos sugeridos (para NO descuidar el lead)`,
    `1) Confirmar rubro, objetivo (ventas/partners/inversión), y mercado objetivo (USA/LatAm).`,
    `2) Definir “siguiente acción” y fecha (SLA interno: 48–72h).`,
    `3) Proponer 2 introducciones + 1 evento recomendado en los próximos 14 días.`,
    `4) Si califica: preparar propuesta de membresía + plan de activación 30 días.`,
    ``,
    `## Preguntas clave (para volver esto real)`,
    `- Sitio web / LinkedIn / redes / catálogo o brochure?`,
    `- ¿Qué busca en UACOC? (clientes, partners, visibilidad, inversión)`,
    `- ¿Qué puede aportar al ecosistema? (ofertas, contactos, capacidad)`,
    ``,
    `---`,
    `Notas del lead (original):`,
    `${notas ? notas : "(vacío)"}`,
    ``,
  ].join("\n");
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = ctx?.params?.id;
    if (!id || !isUuidLike(id)) {
      return NextResponse.json({ data: null, error: "id inválido" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("leads")
      .select("id, ai_context, ai_report, ai_report_updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json({ data: data ?? null, error: null } satisfies ApiResp<any>, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = ctx?.params?.id;
    if (!id || !isUuidLike(id)) {
      return NextResponse.json({ data: null, error: "id inválido" } satisfies ApiResp<null>, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as { ai_context?: string | null };
    const ai_context = typeof body.ai_context === "string" ? body.ai_context : null;

    const supabase = supabaseAdmin();

    // 1) Traer lead base
    const { data: lead, error: lErr } = await supabase
      .from("leads")
      .select("id,nombre,contacto,telefono,email,origen,pipeline,notas,ai_context,ai_report,ai_report_updated_at")
      .eq("id", id)
      .maybeSingle();

    if (lErr) {
      return NextResponse.json({ data: null, error: lErr.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!lead) {
      return NextResponse.json({ data: null, error: "No existe lead" } satisfies ApiResp<null>, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const leadRow: LeadRow = lead as any;

    // 2) Generar reporte (demo)
    const merged: LeadRow = { ...leadRow, ai_context: ai_context ?? leadRow.ai_context ?? null };
    const ai_report = generateAiReportDemo(merged);
    const ai_report_updated_at = nowIso();

    // 3) Guardar
    const { data: saved, error: sErr } = await supabase
      .from("leads")
      .update({
        ai_context: merged.ai_context,
        ai_report,
        ai_report_updated_at,
      })
      .eq("id", id)
      .select("id, ai_context, ai_report, ai_report_updated_at")
      .maybeSingle();

    if (sErr) {
      return NextResponse.json({ data: null, error: sErr.message } satisfies ApiResp<null>, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json({ data: saved ?? null, error: null } satisfies ApiResp<any>, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error inesperado" } satisfies ApiResp<null>, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}