import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { initializeModule } from "@/lib/modules/initializeModule";
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

function parseModule(v: unknown): ModuleId | null {
  if (typeof v !== "string") return null;
  return (MODULE_IDS as readonly string[]).includes(v) ? (v as ModuleId) : null;
}

function permissionForInit(moduleId: ModuleId): string {
  return moduleId === "leads_linkedin_personal" ? "leads.write" : "config.update";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const moduleId = parseModule(body?.module);
  if (!moduleId) {
    return NextResponse.json({ error: "Campo module inválido" }, { status: 400 });
  }

  const user = await allowDevOrRequire(req, permissionForInit(moduleId));
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const seed = body?.seed !== false;

  try {
    const sb = supabaseAdmin();
    const out = await initializeModule(sb, moduleId, { seed });
    return NextResponse.json(out, { status: out.ok ? 200 : 422 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
