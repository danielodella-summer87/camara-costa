import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { normalizeIAPromptsConfig, type PromptBlock } from "@/lib/ai/promptBlocks";

export const dynamic = "force-dynamic";

const CONFIG_KEY = "ai_prompts_v1";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type ApiResp<T> = { data?: T | null; error?: string | null };

export type IAPromptsPayload = {
  basePrompt: string;
  modulos: Record<string, string>;
  prompts?: PromptBlock[];
  updatedAt?: string;
};

async function allowDevOrRequire(req: NextRequest, perm: string) {
  if (process.env.NODE_ENV !== "production") return { id: "dev" };
  return await requirePermission(req, perm);
}

/**
 * GET /api/admin/config/ia
 * Devuelve la configuración de prompts IA (basePrompt, modulos, updatedAt).
 * Si no existe en DB, devuelve data null sin error (la pantalla de config puede usar copia local solo como respaldo de edición).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await allowDevOrRequire(req, "config.read");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    const sb = supabaseAdmin();
    const { data: row, error } = await sb
      .from("config")
      .select("value, updated_at")
      .eq("key", CONFIG_KEY)
      .maybeSingle();

    if (error) throw error;

    if (!row || !row.value) {
      return NextResponse.json(
        {
          data: null,
          error: null,
        } satisfies ApiResp<IAPromptsPayload | null>,
        { status: 200 }
      );
    }

    const parsed = JSON.parse(row.value) as unknown;
    const normalized = normalizeIAPromptsConfig(parsed);
    const payload: IAPromptsPayload = {
      basePrompt: normalized.basePrompt,
      modulos: normalized.modulos,
      prompts: normalized.prompts,
      updatedAt: row.updated_at ?? undefined,
    };

    return NextResponse.json(
      { data: payload, error: null } satisfies ApiResp<IAPromptsPayload>,
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json(
      { data: null, error: message } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/config/ia
 * Persiste la configuración (basePrompt, modulos). updatedAt se ignora y se genera en servidor.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await allowDevOrRequire(req, "config.update");
    if (!user) {
      return NextResponse.json(
        { data: null, error: "No autorizado" } satisfies ApiResp<null>,
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { data: null, error: "Body inválido" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const normalized = normalizeIAPromptsConfig(body);
    const basePrompt = normalized.basePrompt;
    const modulos = normalized.modulos;
    const prompts = normalized.prompts;
    const value = JSON.stringify({ basePrompt, prompts, modulos });
    const sb = supabaseAdmin();

    const { data: row, error } = await sb
      .from("config")
      .upsert({ key: CONFIG_KEY, value }, { onConflict: "key" })
      .select("updated_at")
      .single();

    if (error) throw error;

    const payload: IAPromptsPayload = {
      basePrompt,
      modulos,
      prompts,
      updatedAt: row?.updated_at ?? undefined,
    };

    return NextResponse.json(
      { data: payload, error: null } satisfies ApiResp<IAPromptsPayload>,
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json(
      { data: null, error: message } satisfies ApiResp<null>,
      { status: 500 }
    );
  }
}
