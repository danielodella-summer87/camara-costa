import { isTransientGammaExportPdfUrl } from "@/lib/leads/presentationUtils";

const GAMMA_BASE_URL = "https://public-api.gamma.app/v1.0";

export type GammaProfile = "comercial" | "tecnico";

const GAMMA_TEMPLATE_IDS: Record<GammaProfile, string> = {
  comercial: "g_eei2ys2xo99qpqa",
  tecnico: "g_bsbasmgzmqqryc1",
};

export async function createGammaFromTemplate(params: {
  profile: GammaProfile;
  prompt: string;
}) {
  const apiKey = process.env.GAMMA_API_KEY;
  if (!apiKey) throw new Error("GAMMA_API_KEY no configurada");

  const res = await fetch(`${GAMMA_BASE_URL}/generations/from-template`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      gammaId: GAMMA_TEMPLATE_IDS[params.profile],
      prompt: params.prompt,
      exportAs: "pdf",
      sharingOptions: {
        workspaceAccess: "edit",
        externalAccess: "view",
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gamma create from template error: ${txt}`);
  }

  const data = (await res.json()) as { generationId: string };
  if (process.env.NODE_ENV !== "production") {
    console.log("[GAMMA create raw]", JSON.stringify(data, null, 2));
  }
  return data;
}

export async function getGammaGeneration(generationId: string) {
  const apiKey = process.env.GAMMA_API_KEY;
  if (!apiKey) throw new Error("GAMMA_API_KEY no configurada");

  const res = await fetch(`${GAMMA_BASE_URL}/generations/${generationId}`, {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey,
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gamma get generation error: ${txt}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  if (process.env.NODE_ENV !== "production") {
    console.log("[GAMMA status raw]", JSON.stringify(data, null, 2));
  }
  return data;
}

/** Busca en el JSON de Gamma una URL de export PDF (assets.api.gamma.app/.../export/pdf/...). */
export function extractTransientExportPdfUrlFromGammaPayload(gamma: Record<string, unknown>): string | null {
  const direct =
    (gamma.pdfUrl as string | undefined) ??
    (gamma.exportUrl as string | undefined) ??
    (gamma.fileUrl as string | undefined) ??
    (gamma.downloadUrl as string | undefined) ??
    (gamma.pdf as string | undefined) ??
    (gamma.exportPdfUrl as string | undefined) ??
    (gamma as { files?: Record<string, string> }).files?.pdf ??
    (gamma as { exports?: Record<string, string> }).exports?.pdf ??
    (gamma as { output?: Record<string, string> }).output?.pdf ??
    null;
  if (typeof direct === "string" && isTransientGammaExportPdfUrl(direct)) return direct.trim();

  const seen = new Set<unknown>();
  const walk = (obj: unknown): string | null => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === "string") {
      return isTransientGammaExportPdfUrl(obj) ? obj.trim() : null;
    }
    if (typeof obj !== "object") return null;
    if (seen.has(obj)) return null;
    seen.add(obj);
    if (Array.isArray(obj)) {
      for (const x of obj) {
        const r = walk(x);
        if (r) return r;
      }
      return null;
    }
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const r = walk(v);
      if (r) return r;
    }
    return null;
  };
  return walk(gamma);
}

export type GammaGenerationExportSnapshot = {
  raw: Record<string, unknown>;
  status: string | null;
  gammaUrl: string | null;
  pdfUrl: string | null;
};

/**
 * Tras `completed`, el PDF de export a veces aparece segundos después del `gammaUrl`.
 * Reconsulta la API hasta obtener `pdfUrl` o agotar el tiempo.
 */
export async function getGammaGenerationWithExportPdfWait(
  generationId: string,
  options?: { maxWaitAfterCompletedMs?: number; pollIntervalMs?: number }
): Promise<GammaGenerationExportSnapshot> {
  const maxWait = options?.maxWaitAfterCompletedMs ?? 60_000;
  const interval = options?.pollIntervalMs ?? 2500;

  let raw = (await getGammaGeneration(generationId)) as Record<string, unknown>;
  let status = typeof raw.status === "string" ? raw.status : null;
  let gammaUrl = typeof raw.gammaUrl === "string" && raw.gammaUrl.trim() ? raw.gammaUrl.trim() : null;
  let pdfUrl = extractTransientExportPdfUrlFromGammaPayload(raw);

  if (status !== "completed") {
    return { raw, status, gammaUrl, pdfUrl };
  }

  const deadline = Date.now() + maxWait;
  while (!pdfUrl && Date.now() < deadline) {
    if (raw.status === "failed") break;
    await new Promise((r) => setTimeout(r, interval));
    raw = (await getGammaGeneration(generationId)) as Record<string, unknown>;
    status = typeof raw.status === "string" ? raw.status : status;
    gammaUrl =
      (typeof raw.gammaUrl === "string" && raw.gammaUrl.trim() ? raw.gammaUrl.trim() : null) ?? gammaUrl;
    pdfUrl = extractTransientExportPdfUrlFromGammaPayload(raw);
    if (raw.status === "failed") break;
  }

  return { raw, status, gammaUrl, pdfUrl };
}

export async function waitForGammaCompletion(
  generationId: string,
  timeoutMs = 120000
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const data = await getGammaGeneration(generationId);

    if (data.status === "completed" && data.gammaUrl) {
      return data.gammaUrl;
    }

    if (data.status === "failed") {
      throw new Error("Gamma generation failed");
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error("Gamma generation timeout");
}
