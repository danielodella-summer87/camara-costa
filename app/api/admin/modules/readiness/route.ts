import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { ensureModuleReady } from "@/lib/modules/ensureModuleReady";
import { MODULE_IDS, type ModuleId } from "@/lib/modules/types";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env de Supabase");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function allowDevOrRequire(req: NextRequest, perm: string) {
  if (process.env.NODE_ENV !== "production") return { id: "dev" };
  return await requirePermission(req, perm);
}

function parseModule(v: string | null): ModuleId | null {
  if (!v) return null;
  return (MODULE_IDS as readonly string[]).includes(v) ? (v as ModuleId) : null;
}

function permissionForReadiness(moduleId: ModuleId): string {
  return moduleId === "leads_linkedin_personal" ? "leads.read" : "config.read";
}

export async function GET(req: NextRequest) {
  const moduleId = parseModule(req.nextUrl.searchParams.get("module"));
  if (!moduleId) {
    return NextResponse.json({ error: "Parámetro module inválido o ausente" }, { status: 400 });
  }

  const user = await allowDevOrRequire(req, permissionForReadiness(moduleId));
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const sb = supabaseAdmin();
    const result = await ensureModuleReady(sb, moduleId);
    return NextResponse.json({ result }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
