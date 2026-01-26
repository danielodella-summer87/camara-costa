import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateLeadSafe } from "@/lib/leads/updateLeadSafe";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ✅ validación “suave”: solo formato 8-4-4-4-12 (hex), sin exigir versión RFC
function isUuidLike(v: unknown) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

type BulkPatchBody = {
  ids?: unknown;
  pipeline?: unknown;
};

type BulkDeleteBody = {
  ids?: unknown;
};

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as BulkPatchBody;

    const idsRaw = Array.isArray(body.ids) ? body.ids : [];
    const ids = idsRaw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(isUuidLike);

    const pipeline = cleanStr(body.pipeline);

    if (!ids.length) {
      return NextResponse.json({ data: null, error: "ids inválidos o vacíos" }, { status: 400 });
    }
    if (!pipeline) {
      return NextResponse.json({ data: null, error: "pipeline es obligatorio" }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const normalizedPipeline = pipeline.trim().toLowerCase();

    // Si el pipeline es "Ganado", procesar cada lead individualmente para crear socios
    if (normalizedPipeline === "ganado") {
      const results: any[] = [];
      const warnings: string[] = [];

      for (const leadId of ids) {
        try {
          // Obtener lead completo
          const currentLead = await supabase
            .from("leads")
            .select("pipeline, is_member, nombre, email, telefono, empresa_id, website")
            .eq("id", leadId)
            .maybeSingle();

          if (currentLead.error || !currentLead.data) {
            warnings.push(`Lead ${leadId}: No encontrado`);
            continue;
          }

          const lead = currentLead.data;
          const currentPipeline = cleanStr(lead.pipeline);
          const normalizedCurrent = currentPipeline ? currentPipeline.trim().toLowerCase() : null;
          const wasGanado = normalizedCurrent === "ganado";
          const isAlreadyMember = lead.is_member === true;

          // Resolver empresa_id: si no existe, buscar o crear empresa
          let empresaIdResolved: string | null = lead.empresa_id ?? null;
          let empresaCreated = false;

          if (!empresaIdResolved && lead.nombre) {
            // Buscar empresa existente por nombre (case-insensitive)
            const existingEmpresa = await supabase
              .from("empresas")
              .select("id")
              .ilike("nombre", lead.nombre.trim())
              .limit(1)
              .maybeSingle();

            if (existingEmpresa.data?.id) {
              empresaIdResolved = existingEmpresa.data.id;
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

              const newEmpresa = await supabase
                .from("empresas")
                .insert(empresaPayload)
                .select("id")
                .single();

              if (newEmpresa.data?.id) {
                empresaIdResolved = newEmpresa.data.id;
                empresaCreated = true;
              } else {
                warnings.push(`Lead ${leadId}: Error creando empresa: ${newEmpresa.error?.message ?? "Unknown error"}`);
              }
            }
          }

          // Actualizar pipeline y empresa_id si se resolvió
          // NOTA: Aquí empresaIdResolved se agrega explícitamente cuando se resuelve (creación de socio)
          // Esto es válido porque es un cambio explícito e intencional
          const updatePayload: any = { pipeline };
          if (empresaIdResolved) {
            updatePayload.empresa_id = empresaIdResolved;
          }

          // Usar helper seguro que preserva empresa_id si no viene en payload
          const updateRes = await updateLeadSafe(supabase, leadId, updatePayload, {
            force_unlink_entity: false, // Nunca desvincular en bulk update
          });
          
          // Adaptar resultado al formato esperado
          const adaptedResult = updateRes.data 
            ? { data: { id: updateRes.data.id, pipeline: updateRes.data.pipeline, updated_at: updateRes.data.updated_at }, error: null }
            : { data: null, error: updateRes.error };
          
          const updateResAdapted = adaptedResult as { data: { id: string; pipeline: string; updated_at: string } | null; error: any };

          if (updateRes.error) {
            warnings.push(`Lead ${leadId}: Error actualizando pipeline: ${updateRes.error.message}`);
            continue;
          }

          if (updateRes.data) {
            results.push(updateRes.data);
          }

          // Si no era "Ganado" antes o no es miembro todavía, crear/actualizar socio
          if (!wasGanado || !isAlreadyMember) {
            const now = new Date().toISOString();
            const today = new Date().toISOString().split("T")[0];

            // Actualizar lead: is_member=true, member_since=now()
            // Usar helper seguro que preserva empresa_id (no incluimos empresa_id en payload, se preserva)
            await updateLeadSafe(supabase, leadId, { is_member: true, member_since: now }, {
              force_unlink_entity: false,
            });

            // Buscar socio existente por lead_id
            const existingSocio = await supabase
              .from("socios")
              .select("id")
              .eq("lead_id", leadId)
              .maybeSingle();

            let socioId: string;

            if (existingSocio.data?.id) {
              socioId = existingSocio.data.id;
            } else {
              // Generar nuevo id tipo S-001, S-002...
              const lastSocio = await supabase
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
            }

            // Preparar datos del socio (con empresa_id resuelto)
            const socioDataBase: any = {
              id: socioId,
              lead_id: leadId,
              nombre: lead.nombre ?? null,
              email: lead.email ?? null,
              telefono: lead.telefono ?? null,
              empresa_id: empresaIdResolved, // Usar empresa_id resuelto
              plan: "Bronce",
              estado: "Activo",
              fecha_alta: today,
              proxima_accion: null,
            };

            // Intentar upsert con codigo
            let socioData = { ...socioDataBase, codigo: socioId };
            let upsertSocio = await supabase
              .from("socios")
              .upsert(socioData, { onConflict: "lead_id" })
              .select("id, empresa_id")
              .maybeSingle();

            // Si falla por columna codigo, reintentar sin codigo
            if (upsertSocio.error && upsertSocio.error.message?.includes("codigo")) {
              socioData = socioDataBase;
              upsertSocio = await supabase
                .from("socios")
                .upsert(socioData, { onConflict: "lead_id" })
                .select("id, empresa_id")
                .maybeSingle();
            }

            if (upsertSocio.error) {
              warnings.push(`Lead ${leadId}: Error creando socio: ${upsertSocio.error.message}`);
            } else if (upsertSocio.data) {
              console.log(`[BULK] Socio upsert OK: leadId=${leadId}, socioId=${socioId}, empresaId=${upsertSocio.data.empresa_id ?? "null"}, empresaCreated=${empresaCreated}`);
            }
          }
        } catch (e: any) {
          warnings.push(`Lead ${leadId}: ${e?.message ?? "Error inesperado"}`);
        }
      }

      return NextResponse.json(
        { 
          data: { updated: results.length, rows: results }, 
          error: null,
          warnings: warnings.length > 0 ? warnings : undefined
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Para otros pipelines, actualizar cada lead individualmente preservando empresa_id
    // NOTA: Solo actualizamos pipeline, NO incluimos empresa_id en el payload (se preserva automáticamente)
    const results: any[] = [];
    const errors: string[] = [];
    
    for (const leadId of ids) {
      const updateResult = await updateLeadSafe(supabase, leadId, { pipeline }, {
        force_unlink_entity: false, // Nunca desvincular en bulk update
      });
      if (updateResult.error) {
        errors.push(`Lead ${leadId}: ${updateResult.error.message}`);
      } else if (updateResult.data) {
        results.push({
          id: updateResult.data.id,
          pipeline: updateResult.data.pipeline,
          updated_at: updateResult.data.updated_at,
        });
      }
    }
    
    const data = results;
    const error = errors.length > 0 ? { message: errors.join("; ") } : null;

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: { updated: (data ?? []).length, rows: data ?? [] }, error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as BulkDeleteBody;

    const idsRaw = Array.isArray(body.ids) ? body.ids : [];
    const ids = idsRaw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(isUuidLike);

    if (!ids.length) {
      return NextResponse.json({ data: null, error: "ids inválidos o vacíos" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase.from("leads").delete().in("id", ids).select("id");

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: { deleted: (data ?? []).length, ids: (data ?? []).map((r) => r.id) }, error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}