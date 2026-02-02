import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { getLabels, type Labels } from "@/lib/labels";

const CONFIG_KEY = "portal_config";

/**
 * Obtiene los labels de personalización en el servidor (RSC, Server Actions).
 * Lee desde public.config key "portal_config" (mismo origen que /api/admin/config/portal).
 */
export async function getServerLabels(): Promise<Labels> {
  try {
    const { data, error } = await supabaseServer
      .from("config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      return getLabels(undefined);
    }

    const config = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    return getLabels(config ?? undefined);
  } catch {
    return getLabels(undefined);
  }
}
