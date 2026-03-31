import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/rbac/requirePermission";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function safeId(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

/** Tiempo estimado restante (s) a partir de progreso y ai_started_at; null si no se puede estimar. */
function estimatedSecondsRemaining(
  progress: number,
  startedAtIso: string | null | undefined
): number | null {
  if (progress >= 100 || progress <= 0) return null;
  if (!startedAtIso) return null;
  const t0 = Date.parse(startedAtIso);
  if (Number.isNaN(t0)) return null;
  const elapsed = (Date.now() - t0) / 1000;
  if (elapsed <= 0) return null;
  const totalEstimated = elapsed / (progress / 100);
  const remaining = totalEstimated - elapsed;
  return Math.max(0, Math.round(remaining));
}

/**
 * GET /api/admin/leads/[id]/ai-report/status
 * Estado de generación async (polling tipo Gamma).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(req, "leads.read");
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const sb = supabaseAdmin();
    const { id: rawId } = await context.params;
    const id = safeId(rawId);
    if (!id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("leads")
      .select(
        "id,ai_report,ai_generation_id,ai_status,ai_progress,ai_current_module,ai_started_at,ai_module_total"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    }

    const row = data as {
      ai_report?: string | null;
      ai_generation_id?: string | null;
      ai_status?: string | null;
      ai_progress?: number | null;
      ai_current_module?: string | null;
      ai_started_at?: string | null;
      ai_module_total?: number | null;
    };

    const hasReport = !!(row.ai_report && String(row.ai_report).trim());
    if (hasReport) {
      return NextResponse.json({
        status: "completed",
        progress: 100,
        currentModule: "",
        estimatedTime: 0,
        generationId: row.ai_generation_id ?? null,
        totalModules: row.ai_module_total ?? null,
      });
    }

    const rawStatus = String(row.ai_status ?? "").toLowerCase();
    if (rawStatus === "error") {
      return NextResponse.json({
        status: "error",
        progress: Math.min(100, Math.max(0, Number(row.ai_progress) || 0)),
        currentModule: row.ai_current_module ?? "",
        estimatedTime: null,
        generationId: row.ai_generation_id ?? null,
        totalModules: row.ai_module_total ?? null,
      });
    }

    const progress = Math.min(100, Math.max(0, Math.round(Number(row.ai_progress) || 0)));
    const status =
      rawStatus === "running" || rawStatus === "pending" ? rawStatus : hasReport ? "completed" : "idle";

    const estimatedTime =
      status === "running" || status === "pending"
        ? estimatedSecondsRemaining(progress, row.ai_started_at ?? null)
        : null;

    return NextResponse.json({
      status,
      progress,
      currentModule: row.ai_current_module ?? "",
      estimatedTime,
      generationId: row.ai_generation_id ?? null,
      totalModules: row.ai_module_total ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
