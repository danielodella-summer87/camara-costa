import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeStr(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

type ApiResp<T> = { data?: T | null; error?: string | null };

/**
 * GET /api/admin/leads/:id
 * Devuelve el Lead individual (para la ficha /admin/leads/[id]).
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;

    const id = safeStr(rawId);
    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    // Intento principal: tabla "leads" con join a empresas
    const q1 = await sb
      .from("leads")
      .select(
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_custom_prompt,linkedin_empresa,linkedin_director,is_member,member_since,empresa_id,score,score_categoria,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre))"
      )
      .eq("id", id)
      .maybeSingle();

    if (!q1.error && q1.data) {
      const row = q1.data;
      return NextResponse.json(
        {
          data: {
            ...row,
            linkedin_empresa: row.linkedin_empresa ?? null,
            linkedin_director: row.linkedin_director ?? null,
          },
          error: null,
        } satisfies ApiResp<any>,
        { status: 200 }
      );
    }

    // Si no existe la tabla o falla por esquema: fallback suave a "lead"
    // (por si el proyecto tiene naming diferente)
    const q2 = await sb
      .from("lead")
      .select(
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_custom_prompt,linkedin_empresa,linkedin_director,is_member,member_since,empresa_id,score,score_categoria,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre))"
      )
      .eq("id", id)
      .maybeSingle();

    if (q2.error) {
      // Si el primer query falló por "tabla no existe", reportamos el error real
      const msg = q1.error?.message || q2.error.message || "Error";
      return NextResponse.json({ data: null, error: msg } satisfies ApiResp<null>, { status: 500 });
    }

    if (!q2.data) {
      return NextResponse.json({ data: null, error: "Lead no encontrado" } satisfies ApiResp<null>, { status: 404 });
    }

    const row = q2.data;
    return NextResponse.json(
      {
        data: {
          ...row,
          linkedin_empresa: row.linkedin_empresa ?? null,
          linkedin_director: row.linkedin_director ?? null,
        },
        error: null,
      } satisfies ApiResp<any>,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}

/**
 * PATCH /api/admin/leads/:id
 * (Opcional) si tu UI edita campos desde la ficha. Si no lo usan, lo dejamos minimal.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;

    const id = safeStr(rawId);
    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ data: null, error: "Body inválido" } satisfies ApiResp<null>, { status: 400 });
    }

    // Normalizar ai_custom_prompt: trim, si queda vacío -> null
    const normalizeCustomPrompt = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    // Manejar is_member y member_since
    const updateData: any = {
      ...body,
      linkedin_empresa: body.linkedin_empresa ?? null,
      linkedin_director: body.linkedin_director ?? null,
      empresa_id: body.empresa_id ?? null, // Permitir actualizar empresa_id
      ai_custom_prompt: normalizeCustomPrompt(body.ai_custom_prompt), // Normalizar: trim, si queda vacío -> null
      score: body.score === null || body.score === undefined ? null : (typeof body.score === "number" && body.score >= 0 && body.score <= 10 ? body.score : null),
      score_categoria: body.score_categoria === null || body.score_categoria === undefined ? null : (typeof body.score_categoria === "string" ? body.score_categoria.trim() || null : null),
    };

    // Si is_member cambia de false a true y member_since no viene, setear member_since=now()
    if (body.is_member === true) {
      // Primero obtenemos el lead actual para verificar si ya era miembro
      const currentLead = await sb.from("leads").select("is_member").eq("id", id).maybeSingle();
      const wasMember = currentLead.data?.is_member === true;
      
      if (!wasMember && body.member_since === undefined) {
        updateData.member_since = new Date().toISOString();
      }
    }

    // Si is_member es false y member_since viene explícitamente como null, limpiarlo
    if (body.is_member === false && body.member_since === null) {
      updateData.member_since = null;
    }

    // Intento principal: "leads"
    const u1 = await sb.from("leads").update(updateData).eq("id", id).select("*").maybeSingle();
    if (!u1.error && u1.data) {
      return NextResponse.json({ data: u1.data, error: null } satisfies ApiResp<any>, { status: 200 });
    }

    // Fallback: "lead"
    const u2 = await sb.from("lead").update(updateData).eq("id", id).select("*").maybeSingle();
    if (u2.error) {
      const msg = u1.error?.message || u2.error.message || "Error";
      return NextResponse.json({ data: null, error: msg } satisfies ApiResp<null>, { status: 500 });
    }

    return NextResponse.json({ data: u2.data ?? null, error: null } satisfies ApiResp<any>, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}

/**
 * DELETE /api/admin/leads/:id
 * (Opcional) si tu UI usa "Eliminar" en la ficha.
 */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;

    const id = safeStr(rawId);
    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    // Intento principal: "leads"
    const d1 = await sb.from("leads").delete().eq("id", id);
    if (!d1.error) {
      return NextResponse.json({ data: { ok: true }, error: null } satisfies ApiResp<any>, { status: 200 });
    }

    // Fallback: "lead"
    const d2 = await sb.from("lead").delete().eq("id", id);
    if (d2.error) {
      return NextResponse.json({ data: null, error: d2.error.message } satisfies ApiResp<null>, { status: 500 });
    }

    return NextResponse.json({ data: { ok: true }, error: null } satisfies ApiResp<any>, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}