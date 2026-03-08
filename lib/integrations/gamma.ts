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
