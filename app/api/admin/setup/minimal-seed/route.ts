import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAnyPermission } from "@/lib/rbac/requirePermission";
import { getInternalUserIdFromRequest } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env de Supabase");
  return createClient(url, key, { auth: { persistSession: false } });
}

type SeedStatus = "created" | "existing";
type SeedItem = { table: string; id: string; status: SeedStatus };

const DEMO = {
  rubroName: "Demo / Test",
  aiCategoryName: "Demo SUMMER87",
  aiPromptName: "Prompt demo SUMMER87",
  aiPromptType: "diagnostic",
  aiProfileName: "Perfil IA demo SUMMER87",
  serviceCategoryName: "Categoría demo SUMMER87",
  serviceName: "Servicio demo SUMMER87",
  roleName: "Rol demo SUMMER87",
  roleCode: "demo_role",
} as const;

async function getOrCreateRubro(sb: ReturnType<typeof supabaseAdmin>): Promise<SeedItem> {
  const found = await sb.from("rubros").select("id,nombre").ilike("nombre", DEMO.rubroName).limit(1);
  if (found.error) throw new Error(`rubros: ${found.error.message}`);
  const first = found.data?.[0];
  if (first?.id) return { table: "rubros", id: String(first.id), status: "existing" };

  const ins = await sb.from("rubros").insert({ nombre: DEMO.rubroName, activo: true }).select("id").single();
  if (ins.error) throw new Error(`rubros insert: ${ins.error.message}`);
  return { table: "rubros", id: String(ins.data.id), status: "created" };
}

async function getOrCreateAiCategory(sb: ReturnType<typeof supabaseAdmin>): Promise<SeedItem> {
  const found = await sb.from("ai_categories").select("id,name").ilike("name", DEMO.aiCategoryName).limit(1);
  if (found.error) throw new Error(`ai_categories: ${found.error.message}`);
  const first = found.data?.[0];
  if (first?.id) return { table: "ai_categories", id: String(first.id), status: "existing" };

  const ins = await sb
    .from("ai_categories")
    .insert({ name: DEMO.aiCategoryName, description: "Categoría mínima demo para setup inicial.", is_active: true })
    .select("id")
    .single();
  if (ins.error) throw new Error(`ai_categories insert: ${ins.error.message}`);
  return { table: "ai_categories", id: String(ins.data.id), status: "created" };
}

async function getOrCreateAiPrompt(sb: ReturnType<typeof supabaseAdmin>, categoryId: string): Promise<SeedItem> {
  const found = await sb
    .from("ai_prompts")
    .select("id,name,type")
    .eq("type", DEMO.aiPromptType)
    .ilike("name", DEMO.aiPromptName)
    .limit(1);
  if (found.error) throw new Error(`ai_prompts: ${found.error.message}`);
  const first = found.data?.[0];
  if (first?.id) return { table: "ai_prompts", id: String(first.id), status: "existing" };

  const ins = await sb
    .from("ai_prompts")
    .insert({
      name: DEMO.aiPromptName,
      type: DEMO.aiPromptType,
      category_id: categoryId,
      description: "Prompt mínimo demo para instancia nueva.",
      prompt_content: "Rol: Analista comercial.\nObjetivo: generar salida demo mínima.",
      status: "validated",
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(`ai_prompts insert: ${ins.error.message}`);
  return { table: "ai_prompts", id: String(ins.data.id), status: "created" };
}

async function getOrCreateAiProfile(sb: ReturnType<typeof supabaseAdmin>): Promise<SeedItem> {
  const found = await sb.from("ai_analysis_profiles").select("id,name").ilike("name", DEMO.aiProfileName).limit(1);
  if (found.error) throw new Error(`ai_analysis_profiles: ${found.error.message}`);
  const first = found.data?.[0];
  if (first?.id) return { table: "ai_analysis_profiles", id: String(first.id), status: "existing" };

  const ins = await sb
    .from("ai_analysis_profiles")
    .insert({
      name: DEMO.aiProfileName,
      description: "Perfil IA mínimo demo.",
      target_client_type: "demo",
      target_industries: ["demo"],
      base_instructions: "Usar este perfil solo para pruebas mínimas de setup.",
      is_active: true,
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(`ai_analysis_profiles insert: ${ins.error.message}`);
  return { table: "ai_analysis_profiles", id: String(ins.data.id), status: "created" };
}

async function getOrCreateProfilePromptLink(
  sb: ReturnType<typeof supabaseAdmin>,
  profileId: string,
  promptId: string
): Promise<SeedItem> {
  const found = await sb
    .from("ai_profile_prompts")
    .select("id")
    .eq("profile_id", profileId)
    .eq("prompt_id", promptId)
    .maybeSingle();
  if (found.error) throw new Error(`ai_profile_prompts: ${found.error.message}`);
  if (found.data?.id) return { table: "ai_profile_prompts", id: String(found.data.id), status: "existing" };

  const ins = await sb
    .from("ai_profile_prompts")
    .insert({
      profile_id: profileId,
      prompt_id: promptId,
      enabled_by_default: true,
      execution_order: 10,
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(`ai_profile_prompts insert: ${ins.error.message}`);
  return { table: "ai_profile_prompts", id: String(ins.data.id), status: "created" };
}

async function getOrCreateServiceCategory(sb: ReturnType<typeof supabaseAdmin>): Promise<SeedItem> {
  const found = await sb
    .from("agency_service_categories")
    .select("id,name")
    .ilike("name", DEMO.serviceCategoryName)
    .limit(1);
  if (found.error) throw new Error(`agency_service_categories: ${found.error.message}`);
  const first = found.data?.[0];
  if (first?.id) return { table: "agency_service_categories", id: String(first.id), status: "existing" };

  const ins = await sb
    .from("agency_service_categories")
    .insert({
      name: DEMO.serviceCategoryName,
      description: "Categoría mínima demo para servicios de agencia.",
      sort_order: 0,
      is_active: true,
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(`agency_service_categories insert: ${ins.error.message}`);
  return { table: "agency_service_categories", id: String(ins.data.id), status: "created" };
}

async function getOrCreateService(sb: ReturnType<typeof supabaseAdmin>, categoryId: string): Promise<SeedItem> {
  const found = await sb.from("agency_services").select("id,name").ilike("name", DEMO.serviceName).limit(1);
  if (found.error) throw new Error(`agency_services: ${found.error.message}`);
  const first = found.data?.[0];
  if (first?.id) return { table: "agency_services", id: String(first.id), status: "existing" };

  const ins = await sb
    .from("agency_services")
    .insert({
      name: DEMO.serviceName,
      category: DEMO.serviceCategoryName,
      category_id: categoryId,
      description: "Servicio mínimo demo para pruebas de propuesta.",
      price_base: 100,
      currency: "USD",
      unit: "monthly",
      default_quantity: 1,
      internal_notes: "Seed mínimo demo",
      is_active: true,
      sort_order: 0,
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(`agency_services insert: ${ins.error.message}`);
  return { table: "agency_services", id: String(ins.data.id), status: "created" };
}

async function getOrCreateRole(sb: ReturnType<typeof supabaseAdmin>): Promise<SeedItem> {
  const foundByCode = await sb.from("agency_roles").select("id,name,code").eq("code", DEMO.roleCode).limit(1);
  if (foundByCode.error) throw new Error(`agency_roles: ${foundByCode.error.message}`);
  const codeRow = foundByCode.data?.[0];
  if (codeRow?.id) return { table: "agency_roles", id: String(codeRow.id), status: "existing" };

  const foundByName = await sb.from("agency_roles").select("id,name,code").ilike("name", DEMO.roleName).limit(1);
  if (foundByName.error) throw new Error(`agency_roles: ${foundByName.error.message}`);
  const nameRow = foundByName.data?.[0];
  if (nameRow?.id) return { table: "agency_roles", id: String(nameRow.id), status: "existing" };

  const foundDemoCode = await sb.from("agency_roles").select("id,code").eq("code", DEMO.roleCode).maybeSingle();
  if (foundDemoCode.error) throw new Error(`agency_roles: ${foundDemoCode.error.message}`);
  if (foundDemoCode.data?.id) return { table: "agency_roles", id: String(foundDemoCode.data.id), status: "existing" };

  const roleCode = String(DEMO.roleCode).trim().replace(/\s+/g, "_").toLowerCase();
  if (!roleCode) throw new Error("agency_roles: code demo inválido");

  const ins = await sb
    .from("agency_roles")
    .insert({ name: DEMO.roleName, code: roleCode, hourly_rate: 50 })
    .select("id")
    .single();
  if (ins.error) throw new Error(`agency_roles insert: ${ins.error.message}`);
  return { table: "agency_roles", id: String(ins.data.id), status: "created" };
}

async function loadSetupCompleted(sb: ReturnType<typeof supabaseAdmin>): Promise<boolean> {
  const cfg = await sb
    .from("public_config")
    .select("value")
    .eq("key", "setup_completed")
    .maybeSingle();
  if (cfg.error) throw new Error(`public_config: ${cfg.error.message}`);
  return String(cfg.data?.value ?? "").trim().toLowerCase() === "true";
}

async function markSetupCompleted(sb: ReturnType<typeof supabaseAdmin>): Promise<void> {
  const upsert = await sb
    .from("public_config")
    .upsert({ key: "setup_completed", value: "true" }, { onConflict: "key" });
  if (upsert.error) throw new Error(`public_config upsert: ${upsert.error.message}`);
}

async function requireSetupAccess(req: NextRequest) {
  const userId = await getInternalUserIdFromRequest();
  if (!userId) {
    return { ok: false as const, status: 401 as const, error: "No autenticado" };
  }

  const allowed = await requireAnyPermission(req, ["config.update", "config.admin"]);
  if (!allowed) {
    return { ok: false as const, status: 403 as const, error: "No autorizado" };
  }
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    const sb = supabaseAdmin();
    const auth = await requireSetupAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const setupCompleted = await loadSetupCompleted(sb);
    return NextResponse.json({ ok: true, setup_completed: setupCompleted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseAdmin();
    const auth = await requireSetupAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const alreadyCompleted = await loadSetupCompleted(sb);
    if (alreadyCompleted) {
      return NextResponse.json({
        ok: true,
        message: "Setup ya ejecutado",
        created: [],
        skipped: ["setup_completed ya estaba en true"],
      });
    }

    const touched: SeedItem[] = [];

    const rubro = await getOrCreateRubro(sb);
    touched.push(rubro);

    const aiCategory = await getOrCreateAiCategory(sb);
    touched.push(aiCategory);

    const aiPrompt = await getOrCreateAiPrompt(sb, aiCategory.id);
    touched.push(aiPrompt);

    const aiProfile = await getOrCreateAiProfile(sb);
    touched.push(aiProfile);

    const profilePrompt = await getOrCreateProfilePromptLink(sb, aiProfile.id, aiPrompt.id);
    touched.push(profilePrompt);

    const svcCategory = await getOrCreateServiceCategory(sb);
    touched.push(svcCategory);

    const svc = await getOrCreateService(sb, svcCategory.id);
    touched.push(svc);

    const role = await getOrCreateRole(sb);
    touched.push(role);

    const labelByTable: Record<string, string> = {
      rubros: "rubro demo",
      ai_categories: "categoría de prompt demo",
      ai_prompts: "prompt demo",
      ai_analysis_profiles: "perfil IA demo",
      ai_profile_prompts: "enlace perfil-prompt demo",
      agency_service_categories: "categoría de servicio demo",
      agency_services: "servicio demo",
      agency_roles: "rol demo",
    };

    const created = touched
      .filter((t) => t.status === "created")
      .map((t) => labelByTable[t.table] ?? `${t.table} demo`);
    const skipped = touched
      .filter((t) => t.status === "existing")
      .map((t) => `${labelByTable[t.table] ?? `${t.table} demo`} ya existía`);

    await markSetupCompleted(sb);

    return NextResponse.json({
      ok: true,
      message: "Setup mínimo ejecutado",
      created,
      skipped,
      touched,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
