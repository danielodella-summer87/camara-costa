import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { getGammaGenerationWithExportPdfWait } from "@/lib/integrations/gamma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission(req, "leads.read");
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const generationId = searchParams.get("generationId")?.trim();

    if (!generationId) {
      return NextResponse.json(
        { ok: false, error: "generationId es requerido" },
        { status: 400 }
      );
    }

    const snap = await getGammaGenerationWithExportPdfWait(generationId, {
      maxWaitAfterCompletedMs: 14_000,
      pollIntervalMs: 2000,
    });
    const gamma = snap.raw;

    if (snap.status === "completed" && process.env.NODE_ENV !== "production") {
      console.log("[GAMMA status completed payload]", JSON.stringify(gamma, null, 2));
    }

    return NextResponse.json({
      ok: true,
      generationId,
      status: snap.status,
      gammaUrl: snap.gammaUrl,
      pdfUrl: snap.pdfUrl,
      ...(process.env.NODE_ENV !== "production" ? { raw: gamma } : {}),
    });
  } catch (e: any) {
    const responseText = e?.message ?? String(e);
    if (/GAMMA_API_KEY/i.test(responseText)) {
      console.error("[GAMMA status] Configuración faltante:", responseText);
      return NextResponse.json(
        { ok: false, error: "El servicio de presentaciones no está disponible. Contacte al administrador del sistema." },
        { status: 503 }
      );
    }
    console.error("[GAMMA status] Error:", responseText);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error consultando estado Gamma" },
      { status: 500 }
    );
  }
}
