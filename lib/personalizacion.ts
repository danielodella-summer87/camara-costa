"use client";

import { useState, useEffect } from "react";
import { fetchLabels } from "@/lib/labels";

/**
 * Hook para usar labels de personalización (ej. "Socios" / "Clientes").
 * Lee desde /api/admin/config/portal (label_member_plural, label_member_singular).
 */
export function usePersonalizacion() {
  const [clientePlural, setClientePlural] = useState<string>("Socios");
  const [clienteSingular, setClienteSingular] = useState<string>("Socio");

  function load() {
    fetchLabels().then((labels) => {
      setClientePlural(labels.memberPlural);
      setClienteSingular(labels.memberSingular);
    });
  }

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("portal-config-updated", handler);
    return () => window.removeEventListener("portal-config-updated", handler);
  }, []);

  return { clientePlural, clienteSingular };
}
