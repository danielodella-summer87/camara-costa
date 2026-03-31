"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModuleId, ModuleReadinessResult } from "./types";

export function useModuleReadiness(moduleId: ModuleId) {
  const [readiness, setReadiness] = useState<ModuleReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<ModuleReadinessResult | null> => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/modules/readiness?module=${encodeURIComponent(moduleId)}`, {
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { result?: ModuleReadinessResult; error?: string };
      if (!r.ok) {
        setReadiness(null);
        return null;
      }
      const result = j.result ?? null;
      setReadiness(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { readiness, loading, refresh };
}
