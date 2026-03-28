import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";

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

type SaveFullBody = {
  profile?: {
    id?: string;
    name?: string;
    target_client_type?: string | null;
    target_industries?: string[];
    description?: string | null;
    base_instructions?: string;
    cierre_oferta_principal?: string | null;
    tipo_organizacion_vendedora?: string | null;
    is_active?: boolean;
  };
  prompts?: Array<{
    prompt_id?: string;
    enabled_by_default?: boolean;
    execution_order?: number;
  }>;
};

export async function POST(req: NextRequest) {
  try {
    const user = await allowDevOrRequire(req, "config.update");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as SaveFullBody;
    const profile = body?.profile ?? {};
    const name = typeof profile.name === "string" ? profile.name.trim() : "";
    if (!name) return NextResponse.json({ error: "profile.name es obligatorio" }, { status: 400 });

    const sb = supabaseAdmin();
    const { data: profileData, error: profileError } = await sb
      .from("ai_analysis_profiles")
      .upsert(
        {
          ...(profile.id ? { id: profile.id } : {}),
          name,
          target_client_type:
            typeof profile.target_client_type === "string"
              ? profile.target_client_type.trim()
              : profile.target_client_type ?? null,
          target_industries: Array.isArray(profile.target_industries)
            ? profile.target_industries.map(String).map((x) => x.trim()).filter(Boolean)
            : [],
          description:
            typeof profile.description === "string"
              ? profile.description.trim()
              : profile.description ?? null,
          base_instructions: typeof profile.base_instructions === "string" ? profile.base_instructions : "",
          ...(typeof profile.cierre_oferta_principal === "string"
            ? { cierre_oferta_principal: profile.cierre_oferta_principal.trim() }
            : profile.cierre_oferta_principal === null
              ? { cierre_oferta_principal: null }
              : {}),
          ...(typeof profile.tipo_organizacion_vendedora === "string"
            ? { tipo_organizacion_vendedora: profile.tipo_organizacion_vendedora.trim() }
            : profile.tipo_organizacion_vendedora === null
              ? { tipo_organizacion_vendedora: null }
              : {}),
          is_active: typeof profile.is_active === "boolean" ? profile.is_active : true,
        },
        { onConflict: "id" }
      )
      .select("id,name,description,target_client_type,target_industries,base_instructions,cierre_oferta_principal,tipo_organizacion_vendedora,is_active,created_at,updated_at")
      .single();

    if (profileError || !profileData?.id) {
      return NextResponse.json({ error: profileError?.message ?? "Error guardando perfil" }, { status: 500 });
    }

    const profileId = String(profileData.id);
    const { error: delErr } = await sb.from("ai_profile_prompts").delete().eq("profile_id", profileId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const prompts = Array.isArray(body?.prompts) ? body.prompts : [];
    const rows = prompts
      .filter((p) => p && typeof p.prompt_id === "string")
      .map((p, i) => ({
        profile_id: profileId,
        prompt_id: String(p.prompt_id),
        enabled_by_default: p.enabled_by_default !== false,
        execution_order: Number.isFinite(Number(p.execution_order))
          ? Number(p.execution_order)
          : i + 1,
      }));

    if (rows.length > 0) {
      const { error: insErr } = await sb.from("ai_profile_prompts").insert(rows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: profileData }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

