import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { getAllowMultipleLeadsPerInitiative } from "@/lib/leads/initiativeLeadPolicy";

export const dynamic = "force-dynamic";

const CONFIG_KEY = "allow_multiple_leads_per_initiative";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function allowDevOrRequire(req: NextRequest, perm: string) {
  if (process.env.NODE_ENV !== "production") return { id: "dev" };
  return await requirePermission(req, perm);
}

type ApiResp<T> = { data?: T | null; error?: string | null };

/**
 * GET — lectura del flag (default false si no hay fila).
 * PATCH — body: { allow_multiple_leads_per_initiative: boolean }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await allowDevOrRequire(req, "config.read");
    if (!user) {
      return NextResponse.json({ data: null, error: "No autorizado" } satisfies ApiResp<null>, { status: 403 });
    }
    const sb = supabaseAdmin();
    const allow = await getAllowMultipleLeadsPerInitiative(sb);
    return NextResponse.json(
      { data: { allow_multiple_leads_per_initiative: allow }, error: null } satisfies ApiResp<{
        allow_multiple_leads_per_initiative: boolean;
      }>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ data: null, error: msg } satisfies ApiResp<null>, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await allowDevOrRequire(req, "config.update");
    if (!user) {
      return NextResponse.json({ data: null, error: "No autorizado" } satisfies ApiResp<null>, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const raw = body?.allow_multiple_leads_per_initiative;
    if (typeof raw !== "boolean") {
      return NextResponse.json(
        { data: null, error: "allow_multiple_leads_per_initiative debe ser boolean" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }
    const value = raw ? "true" : "false";
    const sb = supabaseAdmin();
    const { error } = await sb
      .from("config")
      .upsert(
        { key: CONFIG_KEY, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) {
      return NextResponse.json({ data: null, error: error.message } satisfies ApiResp<null>, { status: 500 });
    }
    return NextResponse.json(
      { data: { allow_multiple_leads_per_initiative: raw }, error: null } satisfies ApiResp<{
        allow_multiple_leads_per_initiative: boolean;
      }>,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ data: null, error: msg } satisfies ApiResp<null>, { status: 500 });
  }
}
