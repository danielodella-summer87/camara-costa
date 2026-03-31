import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateLeadSafe } from "@/lib/leads/updateLeadSafe";
import { serializeLeadCustomPrompt } from "@/lib/leads/customPrompt";
import { isLeadClosed, isLeadWon } from "@/lib/leads/leadStatusPolicy";
import {
  isMissingLeadsLinkedinPersonalColumn,
  leadsSelectWithLinkedinVariant,
  shapeLeadRowLinkedinForApi,
} from "@/lib/leads/linkedinLeadFields";

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

function isMissingColumnError(message: string | undefined, table: string, column: string): boolean {
  const msg = (message ?? "").toLowerCase();
  return msg.includes(`could not find the '${column.toLowerCase()}' column of '${table.toLowerCase()}'`);
}

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
    const selectLeadWithSnapshot =
      "id,created_at,updated_at,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_generation_id,ai_status,ai_progress,ai_current_module,ai_started_at,ai_module_total,ai_custom_prompt,proposal_draft_json,proposal_confirmed_at,proposal_sent_at,proposal_doc_url,presentation_doc_url,proposal_reviewed,commercial_stage,commercial_strategy_json,strategy_approved_at,linkedin_empresa,linkedin_personal,instagram,direccion,is_member,member_since,empresa_id,iniciativa_id,comercial_id,score,score_categoria,meet_url,initiative_kind,project_description,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,facebook,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre)),comerciales:comercial_id(id,nombre)";
    const selectLeadLegacy =
      "id,created_at,updated_at,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_generation_id,ai_status,ai_progress,ai_current_module,ai_started_at,ai_module_total,ai_custom_prompt,proposal_draft_json,proposal_confirmed_at,proposal_sent_at,proposal_doc_url,presentation_doc_url,proposal_reviewed,commercial_stage,commercial_strategy_json,strategy_approved_at,linkedin_empresa,linkedin_personal,is_member,member_since,empresa_id,iniciativa_id,comercial_id,score,score_categoria,meet_url,initiative_kind,project_description,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,facebook,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre)),comerciales:comercial_id(id,nombre)";

    const stripIniciativaId = (sel: string) => sel.replace(",iniciativa_id", "");

    let q1 = await sb.from("leads").select(selectLeadWithSnapshot).eq("id", id).maybeSingle();
    if (q1.error && isMissingColumnError(q1.error.message, "leads", "iniciativa_id")) {
      q1 = await sb
        .from("leads")
        .select(stripIniciativaId(selectLeadWithSnapshot))
        .eq("id", id)
        .maybeSingle();
    }
    if (
      q1.error &&
      (isMissingColumnError(q1.error.message, "leads", "direccion") ||
        isMissingColumnError(q1.error.message, "leads", "instagram"))
    ) {
      q1 = await sb
        .from("leads")
        .select(stripIniciativaId(selectLeadLegacy))
        .eq("id", id)
        .maybeSingle();
    }

    if (q1.error && isMissingLeadsLinkedinPersonalColumn(q1.error.message)) {
      q1 = await sb
        .from("leads")
        .select(leadsSelectWithLinkedinVariant(selectLeadWithSnapshot, "director"))
        .eq("id", id)
        .maybeSingle();
      if (q1.error && isMissingColumnError(q1.error.message, "leads", "iniciativa_id")) {
        q1 = await sb
          .from("leads")
          .select(stripIniciativaId(leadsSelectWithLinkedinVariant(selectLeadWithSnapshot, "director")))
          .eq("id", id)
          .maybeSingle();
      }
      if (
        q1.error &&
        (isMissingColumnError(q1.error.message, "leads", "direccion") ||
          isMissingColumnError(q1.error.message, "leads", "instagram"))
      ) {
        q1 = await sb
          .from("leads")
          .select(stripIniciativaId(leadsSelectWithLinkedinVariant(selectLeadLegacy, "director")))
          .eq("id", id)
          .maybeSingle();
      }
    }

    if (!q1.error && q1.data) {
      const row = q1.data as Record<string, unknown>;
      const comercial = Array.isArray(row.comerciales)
        ? (row.comerciales as unknown[])[0] ?? null
        : (row.comerciales ?? null);
      const commercialStage = row.commercial_stage ?? null;
      const shaped = shapeLeadRowLinkedinForApi(row);
      return NextResponse.json(
        {
          data: {
            ...shaped,
            comerciales: undefined,
            comercial,
            meet_url: row.meet_url ?? null,
            commercial_stage: commercialStage,
            stage: commercialStage,
          },
          error: null,
        } satisfies ApiResp<any>,
        { status: 200 }
      );
    }

    const msg = q1.error?.message ?? "Error cargando lead";
    return NextResponse.json({ data: null, error: msg } satisfies ApiResp<null>, { status: 500 });
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
    // Requerir permiso de actualización de leads
    const { requirePermission } = await import("@/lib/rbac/requirePermission");
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;

    const id = safeStr(rawId);
    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    // Si no es admin, solo puede editar leads donde comercial_id === app_user.id
    const roleRow = await sb.from("roles").select("name").eq("id", user.role_id).maybeSingle();
    const roleName = (roleRow.data as { name?: string } | null)?.name?.trim().toLowerCase();
    const isAdmin = roleName === "admin";

    const leadRow = await sb.from("leads").select("comercial_id").eq("id", id).maybeSingle();
    if (!leadRow.data) {
      return NextResponse.json({ data: null, error: "Lead no encontrado" } satisfies ApiResp<null>, { status: 404 });
    }
    const leadComercialId = (leadRow.data as { comercial_id?: string | null }).comercial_id ?? null;

    if (!isAdmin) {
      if (leadComercialId !== user.id) {
        return NextResponse.json(
          { data: null, error: "No tenés permiso para editar este lead" } satisfies ApiResp<null>,
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ data: null, error: "Body inválido" } satisfies ApiResp<null>, { status: 400 });
    }

    // Normalizar ai_custom_prompt: acepta string (JSON o legacy) u objeto por módulo; guardamos TEXT en DB
    const normalizeCustomPrompt = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const serialized = serializeLeadCustomPrompt(value as Record<string, string>);
        return serialized;
      }
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      if (!trimmed.length) return null;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          return serializeLeadCustomPrompt(parsed as Record<string, string>) ?? trimmed;
        }
      } catch {
        // String plano legacy: guardar tal cual
      }
      return trimmed;
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

    // Lead actual: pipeline + LinkedIn (lectura legacy incluye director si personal aún no existe en BD)
    let currentLead = await sb
      .from("leads")
      .select("linkedin_empresa,linkedin_personal,linkedin_director,pipeline")
      .eq("id", id)
      .maybeSingle();
    if (currentLead.error && isMissingLeadsLinkedinPersonalColumn(currentLead.error.message)) {
      currentLead = await sb
        .from("leads")
        .select("linkedin_empresa,linkedin_director,pipeline")
        .eq("id", id)
        .maybeSingle();
    }

    const currentLinkedinEmpresa = currentLead.data?.linkedin_empresa ?? null;
    const rawPersonal = currentLead.data?.linkedin_personal;
    const rawDirector = (currentLead.data as { linkedin_director?: string | null })?.linkedin_director;
    const currentLinkedinPersonal =
      (typeof rawPersonal === "string" && rawPersonal.trim()) ||
      (typeof rawDirector === "string" && rawDirector.trim()) ||
      null;

    // Normalizar valores entrantes (cuerpo canónico: linkedin_personal; se acepta linkedin_director por compat)
    const incomingEmpresa = typeof body.linkedin_empresa === "string" ? body.linkedin_empresa.trim() : null;
    let incomingPersonal: string | null | undefined = undefined;
    if (body.linkedin_personal !== undefined) {
      incomingPersonal = typeof body.linkedin_personal === "string" ? body.linkedin_personal.trim() : null;
    } else if (body.linkedin_director !== undefined) {
      incomingPersonal = typeof body.linkedin_director === "string" ? body.linkedin_director.trim() : null;
    }
    const allowClear = body.allow_clear_linkedin === true;

    // Construir updateData: solo incluir campos presentes en body (evitar sobrescribir con null al hacer PATCH parcial)
    const updateData: any = {};
    if (body.ai_custom_prompt !== undefined) {
      updateData.ai_custom_prompt = normalizeCustomPrompt(body.ai_custom_prompt);
    }
    if (body.proposal_draft_json !== undefined) {
      const v = body.proposal_draft_json;
      updateData.proposal_draft_json = v === null || v === "" ? null : (typeof v === "string" ? v : JSON.stringify(v));
    }
    if (body.proposal_confirmed_at !== undefined) {
      updateData.proposal_confirmed_at = body.proposal_confirmed_at === null || body.proposal_confirmed_at === "" ? null : body.proposal_confirmed_at;
    }
    if (body.proposal_sent_at !== undefined) {
      updateData.proposal_sent_at = body.proposal_sent_at === null || body.proposal_sent_at === "" ? null : body.proposal_sent_at;
    }
    if (body.proposal_reviewed !== undefined) {
      updateData.proposal_reviewed = Boolean(body.proposal_reviewed);
    }
    if (body.commercial_strategy_json !== undefined) {
      const v = body.commercial_strategy_json;
      if (v === null || v === "") {
        updateData.commercial_strategy_json = null;
      } else if (typeof v === "string") {
        try {
          updateData.commercial_strategy_json = JSON.parse(v);
        } catch {
          return NextResponse.json({ data: null, error: "commercial_strategy_json inválido" } satisfies ApiResp<null>, {
            status: 400,
          });
        }
      } else {
        updateData.commercial_strategy_json = v;
      }
    }
    if (body.strategy_approved_at !== undefined) {
      updateData.strategy_approved_at =
        body.strategy_approved_at === null || body.strategy_approved_at === ""
          ? null
          : String(body.strategy_approved_at);
    }
    if (body.proposal_doc_url !== undefined) {
      updateData.proposal_doc_url =
        body.proposal_doc_url === null || body.proposal_doc_url === ""
          ? null
          : String(body.proposal_doc_url);
    }
    if (body.presentation_doc_url !== undefined) {
      updateData.presentation_doc_url =
        body.presentation_doc_url === null || body.presentation_doc_url === ""
          ? null
          : String(body.presentation_doc_url);
    }
    const stageIncoming = body.commercial_stage !== undefined ? body.commercial_stage : body.stage;
    if (stageIncoming !== undefined) {
      if (stageIncoming === null || stageIncoming === "") {
        updateData.commercial_stage = null;
      } else {
        const s = String(stageIncoming).trim().toLowerCase();
        if (s !== "closing") {
          return NextResponse.json(
            {
              data: null,
              error: 'commercial_stage / stage solo admite "closing" o vacío/null',
            } satisfies ApiResp<null>,
            { status: 400 }
          );
        }
        updateData.commercial_stage = "closing";
      }
    }
    if (body.score !== undefined) {
      updateData.score = body.score === null ? null : (typeof body.score === "number" && body.score >= 0 && body.score <= 10 ? body.score : null);
    }
    if (body.score_categoria !== undefined) {
      updateData.score_categoria = body.score_categoria === null ? null : (typeof body.score_categoria === "string" ? body.score_categoria.trim() || null : null);
    }

    // LinkedIn Empresa: solo incluir si cambió explícitamente o si se permite borrar
    if (body.linkedin_empresa !== undefined) {
      if (incomingEmpresa && incomingEmpresa.length > 0) {
        // Valor nuevo no vacío → incluir en update
        updateData.linkedin_empresa = incomingEmpresa;
      } else if (allowClear) {
        // Valor vacío/null pero se permite borrar explícitamente
        updateData.linkedin_empresa = null;
      } else if (currentLinkedinEmpresa) {
        // Valor vacío/null pero lead actual tiene valor → NO incluir (preservar)
        // No hacer nada, no incluir en updateData
      } else {
        // Valor vacío/null y lead actual también está vacío → no incluir (no cambió)
        // No hacer nada
      }
    }

    // LinkedIn contacto (canónico: linkedin_personal; no escribir linkedin_director)
    if (incomingPersonal !== undefined) {
      if (incomingPersonal && incomingPersonal.length > 0) {
        updateData.linkedin_personal = incomingPersonal;
      } else if (allowClear) {
        updateData.linkedin_personal = null;
      } else if (currentLinkedinPersonal) {
        // preservar
      } else {
        // sin cambio
      }
    }

    // Incluir otros campos del body (excepto metadatos / campos ya normalizados arriba)
    for (const [key, value] of Object.entries(body)) {
      if (
        key !== "force_unlink_entity" &&
        key !== "empresa_id" &&
        key !== "comercial_id" &&
        key !== "ai_custom_prompt" &&
        key !== "proposal_draft_json" &&
        key !== "proposal_confirmed_at" &&
        key !== "proposal_sent_at" &&
        key !== "proposal_reviewed" &&
        key !== "commercial_strategy_json" &&
        key !== "strategy_approved_at" &&
        key !== "proposal_doc_url" &&
        key !== "presentation_doc_url" &&
        key !== "commercial_stage" &&
        key !== "stage" &&
        key !== "allow_clear_linkedin" &&
        key !== "linkedin_personal" &&
        key !== "linkedin_director"
      ) {
        updateData[key] = value;
      }
    }

    // Solo incluir empresa_id si viene explícitamente en el body
    if (body.empresa_id !== undefined) {
      updateData.empresa_id = body.empresa_id;
    }

    // Solo incluir comercial_id si viene explícitamente en el body
    if (body.comercial_id !== undefined) {
      updateData.comercial_id = body.comercial_id;
    }

    // Agregar meet_url normalizado si fue proporcionado
    if (body.meet_url !== undefined) {
      updateData.meet_url = meetUrlNormalized;
    }

    // Si is_member cambia de false a true y member_since no viene, setear member_since=now()
    if (body.is_member === true) {
      // Primero obtenemos el lead actual para verificar si ya era miembro
      const memberRow = await sb.from("leads").select("is_member").eq("id", id).maybeSingle();
      const wasMember = memberRow.data?.is_member === true;
      
      if (!wasMember && body.member_since === undefined) {
        updateData.member_since = new Date().toISOString();
      }
    }

    // Si is_member es false y member_since viene explícitamente como null, limpiarlo
    if (body.is_member === false && body.member_since === null) {
      updateData.member_since = null;
    }

    // Validar que no se pueda cambiar la etapa si el lead está en pipeline de cierre (leadStatusPolicy)
    if (body.pipeline !== undefined) {
      if (currentLead.data?.pipeline != null) {
        const currentPipeline = safeStr(currentLead.data.pipeline);
        if (currentPipeline && isLeadClosed(currentPipeline)) {
          return NextResponse.json(
            {
              data: null,
              error:
                "Lead cerrado: no se puede cambiar la etapa desde un pipeline de cierre (ver política en lib/leads/leadStatusPolicy).",
            } satisfies ApiResp<null>,
            { status: 409 }
          );
        }
      }
    }

    // Detectar cambio de pipeline a "Ganado" y crear socio automáticamente
    let socioCreationError: string | null = null;
    if (body.pipeline !== undefined) {
      const newPipeline = safeStr(body.pipeline);

      if (newPipeline && isLeadWon(newPipeline)) {
        // Obtener lead completo para verificar pipeline anterior y si ya es miembro
        const currentLead = await sb
          .from("leads")
          .select("pipeline, is_member, nombre, email, telefono, empresa_id, website")
          .eq("id", id)
          .maybeSingle();

        if (currentLead.data) {
          const currentPipeline = safeStr(currentLead.data.pipeline);
          const wasGanado = currentPipeline ? isLeadWon(currentPipeline) : false;
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
      // Re-hidratar el lead completo con el mismo select que el GET (incluyendo empresas)
      const selectQueryWithSnapshot =
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_custom_prompt,proposal_draft_json,proposal_confirmed_at,proposal_sent_at,proposal_doc_url,presentation_doc_url,proposal_reviewed,commercial_stage,linkedin_empresa,linkedin_personal,instagram,direccion,is_member,member_since,empresa_id,comercial_id,score,score_categoria,meet_url,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,facebook,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre))";
      const selectQueryLegacy =
        "id,nombre,contacto,telefono,email,origen,pipeline,notas,website,objetivos,audiencia,tamano,oferta,ai_context,ai_report,ai_report_updated_at,ai_custom_prompt,proposal_draft_json,proposal_confirmed_at,proposal_sent_at,proposal_doc_url,presentation_doc_url,proposal_reviewed,commercial_stage,linkedin_empresa,linkedin_personal,is_member,member_since,empresa_id,comercial_id,score,score_categoria,meet_url,empresas:empresa_id(id,nombre,email,telefono,celular,rut,direccion,ciudad,pais,web,instagram,facebook,contacto_nombre,contacto_celular,contacto_email,etiquetas,rubro_id,rubros:rubro_id(id,nombre))";

      let refreshed = await sb.from("leads").select(selectQueryWithSnapshot).eq("id", id).maybeSingle();
      if (refreshed.error && isMissingLeadsLinkedinPersonalColumn(refreshed.error.message)) {
        refreshed = await sb
          .from("leads")
          .select(leadsSelectWithLinkedinVariant(selectQueryWithSnapshot, "director"))
          .eq("id", id)
          .maybeSingle();
      }
      if (
        refreshed.error &&
        (isMissingColumnError(refreshed.error.message, "leads", "direccion") ||
          isMissingColumnError(refreshed.error.message, "leads", "instagram"))
      ) {
        refreshed = await sb.from("leads").select(selectQueryLegacy).eq("id", id).maybeSingle();
      }
      if (refreshed.error && isMissingLeadsLinkedinPersonalColumn(refreshed.error.message)) {
        refreshed = await sb
          .from("leads")
          .select(leadsSelectWithLinkedinVariant(selectQueryLegacy, "director"))
          .eq("id", id)
          .maybeSingle();
      }

      if (!refreshed.error && refreshed.data) {
        const row = refreshed.data as Record<string, unknown>;
        const cs = row.commercial_stage ?? null;
        const shaped = shapeLeadRowLinkedinForApi(row);
        const fullLead = {
          ...shaped,
          meet_url: row.meet_url ?? null,
          commercial_stage: cs,
          stage: cs,
        };
        
        // Si hubo error al crear socio pero el lead se actualizó, incluir advertencia
        if (socioCreationError) {
          return NextResponse.json(
            { 
              data: fullLead, 
              error: null,
              warning: `Lead actualizado a Ganado, pero ${socioCreationError}. El lead quedó en Ganado pero no se creó el socio/cliente.` 
            } satisfies ApiResp<any> & { warning?: string },
            { status: 200 }
          );
        }
        return NextResponse.json({ data: fullLead, error: null } satisfies ApiResp<any>, { status: 200 });
      }
      
      // Si falla el refresh, devolver el resultado del update (sin empresas, pero mejor que nada)
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
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Requerir permiso de eliminación de leads
    const { requirePermission } = await import("@/lib/rbac/requirePermission");
    const user = await requirePermission(req, "leads.write");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;

    const id = safeStr(rawId);
    if (!id) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }

    const del = await sb.from("leads").delete().eq("id", id);
    if (del.error) {
      return NextResponse.json({ data: null, error: del.error.message } satisfies ApiResp<null>, { status: 500 });
    }
    return NextResponse.json({ data: { ok: true }, error: null } satisfies ApiResp<any>, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}