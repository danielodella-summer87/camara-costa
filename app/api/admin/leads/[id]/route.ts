import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateLeadSafe } from "@/lib/leads/updateLeadSafe";

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
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_custom_prompt,linkedin_empresa,linkedin_director,is_member,member_since,empresa_id,score,score_categoria,meet_url,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre))"
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
            meet_url: row.meet_url ?? null,
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
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_custom_prompt,linkedin_empresa,linkedin_director,is_member,member_since,empresa_id,score,score_categoria,meet_url,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre))"
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
          meet_url: row.meet_url ?? null,
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

    // Validar meet_url si viene
    let meetUrlNormalized: string | null = null;
    if (body.meet_url !== undefined) {
      if (body.meet_url === null) {
        meetUrlNormalized = null;
      } else {
        const meetUrlStr = safeStr(body.meet_url);
        if (meetUrlStr !== null) {
          // Validación opcional: debe empezar con https://meet.google.com/
          if (!meetUrlStr.startsWith("https://meet.google.com/")) {
            return NextResponse.json(
              { data: null, error: "meet_url debe empezar con https://meet.google.com/" } satisfies ApiResp<null>,
              { status: 400 }
            );
          }
          meetUrlNormalized = meetUrlStr;
        } else {
          // Si viene como string vacío, normalizar a null
          meetUrlNormalized = null;
        }
      }
    }

    // Validar empresa_id ANTES de construir updateData
    // REGLA: Si empresa_id viene como null, SOLO aceptar si force_unlink_entity: true
    if (body.empresa_id === null && body.force_unlink_entity !== true) {
      // Log temporal para detectar intentos
      console.error(`[PATCH lead] ⚠️ INTENTO DE SETEAR empresa_id A NULL SIN force_unlink_entity: Lead ${id}`);
      console.error(`[PATCH lead] Body recibido:`, JSON.stringify(body, null, 2));
      
      return NextResponse.json(
        { 
          data: null, 
          error: "No se puede desvincular empresa_id sin el flag force_unlink_entity: true. Si realmente deseas desvincular, incluye force_unlink_entity: true en el request." 
        } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    // Construir updateData: solo incluir empresa_id si viene explícitamente en el body
    const updateData: any = {
      linkedin_empresa: body.linkedin_empresa ?? null,
      linkedin_director: body.linkedin_director ?? null,
      ai_custom_prompt: normalizeCustomPrompt(body.ai_custom_prompt), // Normalizar: trim, si queda vacío -> null
      score: body.score === null || body.score === undefined ? null : (typeof body.score === "number" && body.score >= 0 && body.score <= 10 ? body.score : null),
      score_categoria: body.score_categoria === null || body.score_categoria === undefined ? null : (typeof body.score_categoria === "string" ? body.score_categoria.trim() || null : null),
    };

    // Incluir otros campos del body (excepto force_unlink_entity que es solo para validación)
    for (const [key, value] of Object.entries(body)) {
      if (key !== "force_unlink_entity" && key !== "empresa_id") {
        updateData[key] = value;
      }
    }

    // Solo incluir empresa_id si viene explícitamente en el body
    if (body.empresa_id !== undefined) {
      updateData.empresa_id = body.empresa_id;
    }

    // Agregar meet_url normalizado si fue proporcionado
    if (body.meet_url !== undefined) {
      updateData.meet_url = meetUrlNormalized;
    }

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

    // Validar que no se pueda cambiar la etapa si el lead está cerrado (Ganado/Perdido)
    if (body.pipeline !== undefined) {
      // Primero obtener el pipeline actual del lead
      const currentLead = await sb
        .from("leads")
        .select("pipeline")
        .eq("id", id)
        .maybeSingle();

      if (currentLead.data?.pipeline) {
        const currentPipeline = safeStr(currentLead.data.pipeline);
        const normalizedCurrent = currentPipeline ? currentPipeline.trim().toLowerCase() : null;
        
        // Si el lead está en Ganado o Perdido, rechazar cualquier cambio
        if (normalizedCurrent === "ganado" || normalizedCurrent === "perdido") {
          return NextResponse.json(
            { data: null, error: "Lead cerrado: no se puede cambiar la etapa desde Ganado/Perdido." } satisfies ApiResp<null>,
            { status: 409 }
          );
        }
      }
    }

    // Detectar cambio de pipeline a "Ganado" y crear socio automáticamente
    let socioCreationError: string | null = null;
    if (body.pipeline !== undefined) {
      const newPipeline = safeStr(body.pipeline);
      const normalizedNewPipeline = newPipeline ? newPipeline.trim().toLowerCase() : null;
      
      if (normalizedNewPipeline === "ganado") {
        // Obtener lead completo para verificar pipeline anterior y si ya es miembro
        const currentLead = await sb
          .from("leads")
          .select("pipeline, is_member, nombre, email, telefono, empresa_id, website")
          .eq("id", id)
          .maybeSingle();

        if (currentLead.data) {
          const currentPipeline = safeStr(currentLead.data.pipeline);
          const normalizedCurrentPipeline = currentPipeline ? currentPipeline.trim().toLowerCase() : null;
          const wasGanado = normalizedCurrentPipeline === "ganado";
          const isAlreadyMember = currentLead.data.is_member === true;

          // Si no era "Ganado" antes o no es miembro todavía, crear/actualizar socio
          // Esto hace que sea idempotente: si ya existe, solo actualiza
          if (!wasGanado || !isAlreadyMember) {
            const lead = currentLead.data;
            const now = new Date().toISOString();
            const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

            // Actualizar lead: is_member=true, member_since=now()
            updateData.is_member = true;
            updateData.member_since = now;

            try {
              // Resolver empresa_id: si no existe, buscar o crear empresa
              let empresaIdResolved: string | null = lead.empresa_id ?? null;
              let empresaCreated = false;

              if (!empresaIdResolved && lead.nombre) {
                console.log(`[PATCH lead] Lead ${id} sin empresa_id, buscando/creando empresa...`);
                
                // Buscar empresa existente por nombre (case-insensitive)
                const existingEmpresa = await sb
                  .from("empresas")
                  .select("id")
                  .ilike("nombre", lead.nombre.trim())
                  .limit(1)
                  .maybeSingle();

                if (existingEmpresa.data?.id) {
                  empresaIdResolved = existingEmpresa.data.id;
                  console.log(`[PATCH lead] Empresa encontrada: ${empresaIdResolved}`);
                  
                  // Actualizar lead con empresa_id encontrada
                  updateData.empresa_id = empresaIdResolved;
                } else {
                  // Crear nueva empresa con datos del lead
                  const empresaPayload: any = {
                    nombre: lead.nombre.trim(),
                    tipo: "empresa",
                    email: lead.email ?? null,
                    telefono: lead.telefono ?? null,
                    web: lead.website ?? null,
                    estado: "Pendiente",
                    aprobada: false,
                  };

                  const newEmpresa = await sb
                    .from("empresas")
                    .insert(empresaPayload)
                    .select("id")
                    .single();

                  if (newEmpresa.data?.id) {
                    empresaIdResolved = newEmpresa.data.id;
                    empresaCreated = true;
                    console.log(`[PATCH lead] Empresa creada: ${empresaIdResolved}`);
                    
                    // Actualizar lead con empresa_id creada
                    updateData.empresa_id = empresaIdResolved;
                  } else {
                    console.error(`[PATCH lead] Error creando empresa:`, newEmpresa.error);
                    socioCreationError = `Error creando empresa: ${newEmpresa.error?.message ?? "Unknown error"}`;
                  }
                }
              }

              // Buscar socio existente por lead_id (idempotencia)
              const existingSocio = await sb
                .from("socios")
                .select("id")
                .eq("lead_id", id)
                .maybeSingle();

              let socioId: string;

              if (existingSocio.data?.id) {
                // Ya existe, usar su id
                socioId = existingSocio.data.id;
                console.log(`[PATCH lead] Socio existente: ${socioId}`);
              } else {
                // Generar nuevo id tipo S-001, S-002...
                const lastSocio = await sb
                  .from("socios")
                  .select("id")
                  .order("id", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                socioId = "S-001";
                if (lastSocio.data?.id) {
                  const match = String(lastSocio.data.id).match(/^S-(\d+)$/);
                  if (match) {
                    const num = parseInt(match[1], 10);
                    const nextNum = num + 1;
                    socioId = `S-${String(nextNum).padStart(3, "0")}`;
                  }
                }
                console.log(`[PATCH lead] Nuevo socio ID generado: ${socioId}`);
              }

              // Preparar datos del socio (con empresa_id resuelto)
              const socioDataBase: any = {
                id: socioId,
                lead_id: id,
                nombre: lead.nombre ?? null,
                email: lead.email ?? null,
                telefono: lead.telefono ?? null,
                empresa_id: empresaIdResolved, // Usar empresa_id resuelto (puede ser null si falló)
                plan: "Bronce",
                estado: "Activo",
                fecha_alta: today,
                proxima_accion: null,
              };

              // Intentar upsert con codigo (idempotente: onConflict="lead_id")
              let socioData = { ...socioDataBase, codigo: socioId };
              let upsertSocio = await sb
                .from("socios")
                .upsert(socioData, { onConflict: "lead_id" })
                .select("id, empresa_id")
                .maybeSingle();

              // Si falla por columna codigo, reintentar sin codigo
              if (upsertSocio.error && upsertSocio.error.message?.includes("codigo")) {
                socioData = socioDataBase;
                upsertSocio = await sb
                  .from("socios")
                  .upsert(socioData, { onConflict: "lead_id" })
                  .select("id, empresa_id")
                  .maybeSingle();
              }

              // Log de confirmación
              if (upsertSocio.data) {
                console.log(`[PATCH lead] Socio upsert OK: leadId=${id}, socioId=${socioId}, empresaId=${upsertSocio.data.empresa_id ?? "null"}, empresaCreated=${empresaCreated}`);
              }

              // Si aún hay error, guardarlo pero NO revertir el cambio de etapa
              if (upsertSocio.error) {
                socioCreationError = `Error creando socio: ${upsertSocio.error.message}`;
                console.error(`[PATCH lead] Error creando socio: leadId=${id}`, upsertSocio.error);
              }
            } catch (e: any) {
              // Error inesperado al crear socio
              socioCreationError = `Error inesperado creando socio: ${e?.message ?? "Unknown error"}`;
              console.error(`[PATCH lead] Error inesperado creando socio: leadId=${id}`, e);
              // NO revertimos el cambio de etapa, pero guardamos el error para reportarlo
            }
          }
        }
      }
    }

    // Actualizar usando helper seguro que preserva empresa_id
    const updateResult = await updateLeadSafe(sb, id, updateData, {
      force_unlink_entity: body.force_unlink_entity === true,
    });
    
    if (!updateResult.error && updateResult.data) {
      // Si hubo error al crear socio pero el lead se actualizó, incluir advertencia
      if (socioCreationError) {
        return NextResponse.json(
          { 
            data: updateResult.data, 
            error: null,
            warning: `Lead actualizado a Ganado, pero ${socioCreationError}. El lead quedó en Ganado pero no se creó el socio/cliente.` 
          } satisfies ApiResp<any> & { warning?: string },
          { status: 200 }
        );
      }
      return NextResponse.json({ data: updateResult.data, error: null } satisfies ApiResp<any>, { status: 200 });
    }

    // Si falló, retornar error
    const msg = updateResult.error?.message || "Error actualizando lead";
    return NextResponse.json({ data: null, error: msg } satisfies ApiResp<null>, { status: 500 });
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