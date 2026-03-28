import { NextRequest, NextResponse } from "next/server";
import { postQuantecWebhook } from "@/lib/integrations/quantec/client";

/**
 * ETAPA 1
 * Endpoint interno para probar integración backend con Quantec (solo POST).
 *
 * Hace la llamada server-to-server al webhook externo,
 * mide tiempos y clasifica: acuse de workflow vs payload de lead.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestStartedAt = Date.now();

  let body: Record<string, unknown> = {};

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  console.log("[Quantec Import][POST] Inicio de importación", {
    bodyKeys: Object.keys(body),
  });

  const result = await postQuantecWebhook({ body });

  const totalDurationMs = Date.now() - requestStartedAt;

  if (!result.ok) {
    console.log("[Quantec Import][POST] fetch fallido", {
      status: result.status,
      error: result.error,
      totalDurationMs,
    });
    return NextResponse.json(
      {
        ok: false,
        source: "quantec",
        stage: "fetch",
        totalDurationMs,
        error: result.error,
        externalStatus: result.status,
      },
      { status: result.status >= 400 && result.status < 600 ? result.status : 500 }
    );
  }

  if (result.isLeadPayload) {
    console.log("[Quantec Import][POST] lead payload received", {
      externalStatus: result.status,
      durationMs: result.durationMs,
      totalDurationMs,
      payloadKeys: Object.keys(result.payload as object),
    });
    return NextResponse.json(
      {
        ok: true,
        source: "quantec",
        stage: "fetch",
        mode: "lead_payload",
        totalDurationMs,
        externalStatus: result.status,
        payload: result.payload,
      },
      { status: 200 }
    );
  }

  const payload = result.payload as Record<string, unknown>;
  const isWorkflowMessage =
    typeof payload.message === "string" && payload.message.trim().length > 0;

  if (isWorkflowMessage) {
    console.log("[Quantec Import][POST] workflow accepted / started", {
      message: payload.message,
      externalStatus: result.status,
      durationMs: result.durationMs,
      totalDurationMs,
    });
  } else {
    console.log("[Quantec Import][POST] accepted without lead fields", {
      externalStatus: result.status,
      durationMs: result.durationMs,
      totalDurationMs,
      payloadKeys: Object.keys(payload),
    });
  }

  return NextResponse.json(
    {
      ok: true,
      source: "quantec",
      stage: "fetch",
      mode: "accepted",
      totalDurationMs,
      externalStatus: result.status,
      payload: result.payload,
    },
    { status: 202 }
  );
}
