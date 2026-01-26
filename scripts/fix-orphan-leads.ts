/**
 * Script para reparar leads huérfanos (Desde Entidad pero sin entity_id)
 * 
 * Uso:
 *   npx tsx scripts/fix-orphan-leads.ts          (dry-run, por defecto)
 *   npx tsx scripts/fix-orphan-leads.ts --apply   (aplicar cambios)
 * 
 * O si tienes ts-node instalado:
 *   npx ts-node scripts/fix-orphan-leads.ts
 *   npx ts-node scripts/fix-orphan-leads.ts --apply
 * 
 * Requisitos:
 *   - Variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *   - Ejecutar desde la raíz del proyecto
 */

import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim().toLowerCase();
  if (!u) return null;
  // Normalizar: remover protocolo, www, trailing slash
  let normalized = u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  return normalized || null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e || null;
}

type OrphanLead = {
  id: string;
  nombre: string | null;
  email: string | null;
  website: string | null;
  telefono: string | null;
  empresa_id: string | null;
};

type RepairResult = {
  lead_id: string;
  lead_nombre: string | null;
  email: string | null;
  web: string | null;
  telefono: string | null;
  candidato_entity_id: string | null;
  regla_usada: string;
  status: "REPARADO" | "REVISAR";
};

async function findOrphanLeads(sb: ReturnType<typeof supabaseAdmin>): Promise<OrphanLead[]> {
  // Buscar leads con origen "Desde entidad" (case-insensitive) y empresa_id NULL
  const { data, error } = await sb
    .from("leads")
    .select("id, nombre, email, website, telefono, empresa_id")
    .ilike("origen", "Desde entidad")
    .is("empresa_id", null);

  if (error) {
    throw new Error(`Error buscando leads huérfanos: ${error.message}`);
  }

  return (data || []) as OrphanLead[];
}

async function repairRule1(
  sb: ReturnType<typeof supabaseAdmin>,
  lead: OrphanLead
): Promise<string | null> {
  // Regla 1: Si lead.empresa_id existe -> entity_id = lead.empresa_id
  // Nota: Esta regla no debería aplicarse porque ya filtramos por empresa_id IS NULL,
  // pero la incluimos por completitud y por si hay inconsistencias en los datos
  if (lead.empresa_id) {
    return lead.empresa_id;
  }
  return null;
}

async function repairRule2(
  sb: ReturnType<typeof supabaseAdmin>,
  lead: OrphanLead
): Promise<string | null> {
  // Regla 2: Si existe socio donde socio.lead_id = lead.id:
  //   - si socio tiene empresa_id -> entity_id = socio.empresa_id
  const { data: socio, error } = await sb
    .from("socios")
    .select("empresa_id, empresas:empresa_id(id)")
    .eq("lead_id", lead.id)
    .maybeSingle();

  if (error) {
    console.warn(`[Rule 2] Error consultando socio para lead ${lead.id}: ${error.message}`);
    return null;
  }

  if (socio) {
    // Priorizar empresa_id directo del socio
    if (socio.empresa_id) {
      return socio.empresa_id;
    }
    // Si no tiene empresa_id directo, verificar relación empresas
    if ((socio as any).empresas?.id) {
      return (socio as any).empresas.id;
    }
  }

  return null;
}

async function repairRule3(
  sb: ReturnType<typeof supabaseAdmin>,
  lead: OrphanLead
): Promise<string | null> {
  // Regla 3: Si lead.email existe y hay empresa con email igual -> entity_id = empresa.id
  const normalizedEmail = normalizeEmail(lead.email);
  if (!normalizedEmail) {
    return null;
  }

  const { data: empresas, error } = await sb
    .from("empresas")
    .select("id, email")
    .not("email", "is", null);

  if (error) {
    console.warn(`[Rule 3] Error consultando empresas por email: ${error.message}`);
    return null;
  }

  // Buscar match exacto (case-insensitive)
  const match = empresas?.find((emp) => normalizeEmail(emp.email) === normalizedEmail);
  
  if (match) {
    // Verificar que no haya múltiples matches (debe ser determinístico)
    const matches = empresas?.filter((emp) => normalizeEmail(emp.email) === normalizedEmail) || [];
    if (matches.length === 1) {
      return match.id;
    } else {
      console.warn(`[Rule 3] Múltiples empresas con email ${normalizedEmail}, no se puede determinar`);
      return null;
    }
  }

  return null;
}

async function repairRule4(
  sb: ReturnType<typeof supabaseAdmin>,
  lead: OrphanLead
): Promise<string | null> {
  // Regla 4: Si lead.web existe y hay empresa con web igual -> entity_id = empresa.id
  const normalizedWeb = normalizeWebsite(lead.website);
  if (!normalizedWeb) {
    return null;
  }

  const { data: empresas, error } = await sb
    .from("empresas")
    .select("id, web")
    .not("web", "is", null);

  if (error) {
    console.warn(`[Rule 4] Error consultando empresas por web: ${error.message}`);
    return null;
  }

  // Buscar match exacto (normalizado)
  const matches = empresas?.filter((emp) => normalizeWebsite(emp.web) === normalizedWeb) || [];
  
  if (matches.length === 1) {
    return matches[0].id;
  } else if (matches.length > 1) {
    console.warn(`[Rule 4] Múltiples empresas con web ${normalizedWeb}, no se puede determinar`);
    return null;
  }

  return null;
}

async function repairLead(
  sb: ReturnType<typeof supabaseAdmin>,
  lead: OrphanLead
): Promise<RepairResult> {
  let candidatoEntityId: string | null = null;
  let reglaUsada = "N/A";

  // Aplicar reglas en orden
  candidatoEntityId = await repairRule1(sb, lead);
  if (candidatoEntityId) {
    reglaUsada = "Regla 1: lead.empresa_id";
    return {
      lead_id: lead.id,
      lead_nombre: lead.nombre,
      email: lead.email,
      web: lead.website,
      telefono: lead.telefono,
      candidato_entity_id: candidatoEntityId,
      regla_usada: reglaUsada,
      status: "REPARADO",
    };
  }

  candidatoEntityId = await repairRule2(sb, lead);
  if (candidatoEntityId) {
    reglaUsada = "Regla 2: socio.empresa_id";
    return {
      lead_id: lead.id,
      lead_nombre: lead.nombre,
      email: lead.email,
      web: lead.website,
      telefono: lead.telefono,
      candidato_entity_id: candidatoEntityId,
      regla_usada: reglaUsada,
      status: "REPARADO",
    };
  }

  candidatoEntityId = await repairRule3(sb, lead);
  if (candidatoEntityId) {
    reglaUsada = "Regla 3: match por email";
    return {
      lead_id: lead.id,
      lead_nombre: lead.nombre,
      email: lead.email,
      web: lead.website,
      telefono: lead.telefono,
      candidato_entity_id: candidatoEntityId,
      regla_usada: reglaUsada,
      status: "REPARADO",
    };
  }

  candidatoEntityId = await repairRule4(sb, lead);
  if (candidatoEntityId) {
    reglaUsada = "Regla 4: match por web";
    return {
      lead_id: lead.id,
      lead_nombre: lead.nombre,
      email: lead.email,
      web: lead.website,
      telefono: lead.telefono,
      candidato_entity_id: candidatoEntityId,
      regla_usada: reglaUsada,
      status: "REPARADO",
    };
  }

  // No se encontró match determinístico
  return {
    lead_id: lead.id,
    lead_nombre: lead.nombre,
    email: lead.email,
    web: lead.website,
    telefono: lead.telefono,
    candidato_entity_id: null,
    regla_usada: "Ninguna (sin match seguro)",
    status: "REVISAR",
  };
}

async function applyRepair(
  sb: ReturnType<typeof supabaseAdmin>,
  result: RepairResult
): Promise<void> {
  if (result.status !== "REPARADO" || !result.candidato_entity_id) {
    return;
  }

  const { error } = await sb
    .from("leads")
    .update({ empresa_id: result.candidato_entity_id })
    .eq("id", result.lead_id);

  if (error) {
    throw new Error(`Error aplicando reparación a lead ${result.lead_id}: ${error.message}`);
  }
}

function printReport(results: RepairResult[], isDryRun: boolean): void {
  console.log("\n" + "=".repeat(80));
  console.log(`REPORTE DE REPARACIÓN DE LEADS HUÉRFANOS${isDryRun ? " (DRY-RUN)" : ""}`);
  console.log("=".repeat(80));
  console.log(`\nTotal de leads huérfanos encontrados: ${results.length}`);
  
  const reparados = results.filter((r) => r.status === "REPARADO");
  const revisar = results.filter((r) => r.status === "REVISAR");
  
  console.log(`Leads reparados: ${reparados.length}`);
  console.log(`Leads para revisar: ${revisar.length}`);
  
  console.log("\n" + "-".repeat(80));
  console.log("DETALLE POR LEAD:");
  console.log("-".repeat(80));
  
  for (const result of results) {
    console.log(`\nLead ID: ${result.lead_id}`);
    console.log(`  Nombre: ${result.lead_nombre || "—"}`);
    console.log(`  Email: ${result.email || "—"}`);
    console.log(`  Web: ${result.web || "—"}`);
    console.log(`  Teléfono: ${result.telefono || "—"}`);
    console.log(`  Candidato entity_id: ${result.candidato_entity_id || "—"}`);
    console.log(`  Regla usada: ${result.regla_usada}`);
    console.log(`  Estado: ${result.status}`);
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("RESUMEN:");
  console.log("=".repeat(80));
  console.log(`Total: ${results.length}`);
  console.log(`Reparados: ${reparados.length}`);
  console.log(`Para revisar: ${revisar.length}`);
  
  if (reparados.length > 0) {
    console.log("\nReglas aplicadas:");
    const reglasCount: Record<string, number> = {};
    for (const r of reparados) {
      reglasCount[r.regla_usada] = (reglasCount[r.regla_usada] || 0) + 1;
    }
    for (const [regla, count] of Object.entries(reglasCount)) {
      console.log(`  ${regla}: ${count}`);
    }
  }
  
  console.log("\n" + "=".repeat(80));
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--apply");
  const isApply = args.includes("--apply");

  if (isDryRun && !isApply) {
    console.log("🔍 Modo DRY-RUN (no se aplicarán cambios)");
    console.log("   Para aplicar cambios, ejecutar con: --apply\n");
  } else {
    console.log("⚠️  Modo APPLY (se aplicarán cambios en la base de datos)\n");
  }

  try {
    const sb = supabaseAdmin();
    
    console.log("Buscando leads huérfanos...");
    const orphanLeads = await findOrphanLeads(sb);
    console.log(`Encontrados ${orphanLeads.length} leads huérfanos\n`);

    if (orphanLeads.length === 0) {
      console.log("✅ No hay leads huérfanos para reparar.");
      process.exit(0);
    }

    console.log("Aplicando reglas de reparación...");
    const results: RepairResult[] = [];
    
    for (const lead of orphanLeads) {
      const result = await repairLead(sb, lead);
      results.push(result);
      
      // Aplicar reparación si no es dry-run
      if (!isDryRun && result.status === "REPARADO" && result.candidato_entity_id) {
        try {
          await applyRepair(sb, result);
          console.log(`✅ Reparado: ${result.lead_id} → ${result.candidato_entity_id} (${result.regla_usada})`);
        } catch (err: any) {
          console.error(`❌ Error reparando ${result.lead_id}: ${err.message}`);
          result.status = "REVISAR";
          result.regla_usada = `Error: ${err.message}`;
        }
      }
    }

    // Generar reporte
    printReport(results, isDryRun);

    if (isDryRun) {
      console.log("\n💡 Para aplicar estos cambios, ejecutar: node scripts/fix-orphan-leads.ts --apply");
    } else {
      const reparados = results.filter((r) => r.status === "REPARADO");
      console.log(`\n✅ Proceso completado. ${reparados.length} leads reparados.`);
    }

    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ Error fatal:", err.message);
    console.error(err);
    process.exit(1);
  }
}

// Ejecutar
main();
