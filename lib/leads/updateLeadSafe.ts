import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Actualiza un lead preservando empresa_id si no viene en el payload
 * 
 * REGLAS:
 * 1. Si empresa_id NO viene en el payload → NO modificar empresa_id (preservar valor actual)
 * 2. Si empresa_id viene como null → SOLO aceptar si force_unlink_entity: true, caso contrario rechazar
 * 3. Si empresa_id viene con valor → permitir el cambio
 * 
 * @param sb - Cliente de Supabase (admin)
 * @param leadId - ID del lead a actualizar
 * @param payload - Datos a actualizar (puede o no incluir empresa_id)
 * @param options - Opciones adicionales (force_unlink_entity)
 * @returns Resultado de la actualización
 */
export async function updateLeadSafe(
  sb: SupabaseClient,
  leadId: string,
  payload: Record<string, any>,
  options?: { force_unlink_entity?: boolean }
): Promise<{ data: any; error: any }> {
  const forceUnlink = options?.force_unlink_entity === true;

  // REGLA 1: Si empresa_id NO viene en el payload, NO modificar (preservar valor actual)
  if (payload.empresa_id === undefined) {
    // NO incluir empresa_id en el payload, se preservará automáticamente en la DB
    delete payload.empresa_id;
    console.log(`[updateLeadSafe] Lead ${leadId}: empresa_id NO viene en payload, NO modificando (se preserva valor actual en DB)`);
  } else if (payload.empresa_id === null) {
    // REGLA 2: Si empresa_id viene como null, validar force_unlink_entity
    if (!forceUnlink) {
      // Log temporal para detectar intentos de setear a null sin flag
      console.error(`[updateLeadSafe] ⚠️ INTENTO DE SETEAR empresa_id A NULL SIN force_unlink_entity: Lead ${leadId}`);
      console.error(`[updateLeadSafe] Payload recibido:`, JSON.stringify(payload, null, 2));
      console.error(`[updateLeadSafe] Stack trace:`, new Error().stack);
      
      return {
        data: null,
        error: {
          message: "No se puede desvincular empresa_id sin el flag force_unlink_entity: true. Si realmente deseas desvincular, incluye force_unlink_entity: true en el request.",
        },
      };
    }
    console.log(`[updateLeadSafe] Lead ${leadId}: Desvinculando empresa_id (force_unlink_entity: true)`);
  } else {
    // REGLA 3: empresa_id viene con valor, permitir el cambio
    console.log(`[updateLeadSafe] Lead ${leadId}: Actualizando empresa_id a ${payload.empresa_id} (cambio explícito)`);
  }

  // Intentar actualizar en tabla "leads"
  const u1 = await sb
    .from("leads")
    .update(payload)
    .eq("id", leadId)
    .select("*")
    .maybeSingle();

  if (!u1.error && u1.data) {
    return u1;
  }

  // Fallback: intentar en tabla "lead" (por si hay naming diferente)
  const u2 = await sb
    .from("lead")
    .update(payload)
    .eq("id", leadId)
    .select("*")
    .maybeSingle();

  return u2;
}
