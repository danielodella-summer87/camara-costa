"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type TabKey =
  | "resumen"
  | "direccion"
  | "comercial"
  | "marketing"
  | "administracion"
  | "tecnico";

type Theme = {
  bg: string;
  bgActive: string;
  border: string;
  borderActive: string; // lo usamos también como “underline”
  text: string;
};

const THEME: Record<TabKey, Theme> = {
  resumen: {
    bg: "#EAF5FF",
    bgActive: "#D6ECFF",
    border: "#A9D6FF",
    borderActive: "#2E7DDC",
    text: "#0B3B73",
  },
  direccion: {
    bg: "#EEF2FF",
    bgActive: "#E0E7FF",
    border: "#C7D2FE",
    borderActive: "#3A36B1",
    text: "#2C2C7A",
  },
  comercial: {
    bg: "#FFF6DB",
    bgActive: "#FFEAB0",
    border: "#F7D57A",
    borderActive: "#B77900",
    text: "#5B3A00",
  },
  marketing: {
    bg: "#FFEAF3",
    bgActive: "#FFD6E8",
    border: "#FFB3D2",
    borderActive: "#A51E52",
    text: "#7A1E45",
  },
  administracion: {
    bg: "#E9FBF0",
    bgActive: "#D6F7E3",
    border: "#9FE3B9",
    borderActive: "#1B6B45",
    text: "#0F5132",
  },
  tecnico: {
    bg: "#F3EEFF",
    bgActive: "#E7DCFF",
    border: "#CDB7FF",
    borderActive: "#4B2AA6",
    text: "#3B1F72",
  },
};

type TabDef = { key: TabKey; label: string };

const TABS: TabDef[] = [
  { key: "resumen", label: "Resumen" },
  { key: "direccion", label: "Dirección" },
  { key: "comercial", label: "Comercial" },
  { key: "marketing", label: "Marketing" },
  { key: "administracion", label: "Administración" },
  { key: "tecnico", label: "Técnico" },
];

export function RoleTabs({
  basePath,
  defaultTab = "resumen",
  className = "",
}: {
  basePath: string; // "/admin" o "/admin/reportes"
  defaultTab?: TabKey;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const current = (sp.get("tab") as TabKey | null) ?? defaultTab;

  const activeKey = useMemo<TabKey>(() => {
    const exists = TABS.some((t) => t.key === current);
    return exists ? current : defaultTab;
  }, [current, defaultTab]);

  const hrefFor = (key: TabKey) => `${basePath}?tab=${encodeURIComponent(key)}`;

  const onClickTab = (key: TabKey) => {
    const already = pathname === basePath && (sp.get("tab") ?? defaultTab) === key;
    if (already) return;
    router.push(hrefFor(key));
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {TABS.map((t) => {
        const isActive = t.key === activeKey;
        const theme = THEME[t.key];

        // ✅ underline consistente (inset) para TODOS los tabs activos
        const boxShadow = isActive
          ? `0 1px 2px rgba(0,0,0,0.06), inset 0 -4px 0 ${theme.borderActive}`
          : `0 1px 2px rgba(0,0,0,0.04)`;

        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onClickTab(t.key)}
            aria-current={isActive ? "page" : undefined}
            title={t.label}
            className={[
              "rounded-full border px-4 py-2 text-sm transition",
              "hover:opacity-95",
              isActive ? "font-semibold" : "opacity-95",
            ].join(" ")}
            style={{
              backgroundColor: isActive ? theme.bgActive : theme.bg,
              borderColor: isActive ? theme.borderActive : theme.border,
              color: theme.text,
              boxShadow,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}