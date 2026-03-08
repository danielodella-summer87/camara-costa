import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/requirePermission";
import { getGammaGeneration } from "@/lib/integrations/gamma";

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

    const gamma = await getGammaGeneration(generationId) as Record<string, unknown>;

    // Capturar URL de exportación PDF (campo real a confirmar con respuesta de Gamma API)
    const pdfUrl =
      (gamma.pdfUrl as string | null | undefined) ??
      (gamma.exportUrl as string | null | undefined) ??
      (gamma.fileUrl as string | null | undefined) ??
      (gamma.downloadUrl as string | null | undefined) ??
      (gamma.files as Record<string, string> | undefined)?.pdf ??
      (gamma.exports as Record<string, string> | undefined)?.pdf ??
      (gamma.output as Record<string, string> | undefined)?.pdf ??
      null;

    if (gamma.status === "completed" && process.env.NODE_ENV !== "production") {
      console.log("[GAMMA status completed payload]", JSON.stringify(gamma, null, 2));
    }

    return NextResponse.json({
      ok: true,
      generationId,
      status: (gamma.status as string) ?? null,
      gammaUrl: (gamma.gammaUrl as string | null | undefined) ?? null,
      pdfUrl,
      ...(process.env.NODE_ENV !== "production" ? { raw: gamma } : {}),
    });
  } catch (e: any) {
    console.error("[GAMMA status] Error:", e?.message ?? e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error consultando estado Gamma" },
      { status: 500 }
    );
  }
}
