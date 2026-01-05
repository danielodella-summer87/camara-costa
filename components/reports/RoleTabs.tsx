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

type TabDef = {
  key: TabKey;
  label: string;
  // pastel (siempre visible)
  baseCls: string;
  // refuerzo cuando está activo
  activeCls: string;
};

const TABS: TabDef[] = [
  {
    key: "resumen",
    label: "Resumen",
    baseCls: "bg-sky-50 border-sky-200 text-sky-800",
    activeCls: "ring-1 ring-sky-200 shadow-sm",
  },
  {
    key: "direccion",
    label: "Dirección",
    baseCls: "bg-indigo-50 border-indigo-200 text-indigo-800",
    activeCls: "ring-1 ring-indigo-200 shadow-sm",
  },
  {
    key: "comercial",
    label: "Comercial",
    baseCls: "bg-amber-50 border-amber-200 text-amber-900",
    activeCls: "ring-1 ring-amber-200 shadow-sm",
  },
  {
    key: "marketing",
    label: "Marketing",
    baseCls: "bg-pink-50 border-pink-200 text-pink-800",
    activeCls: "ring-1 ring-pink-200 shadow-sm",
  },
  {
    key: "administracion",
    label: "Administración",
    baseCls: "bg-emerald-50 border-emerald-200 text-emerald-800",
    activeCls: "ring-1 ring-emerald-200 shadow-sm",
  },
  {
    key: "tecnico",
    label: "Técnico",
    baseCls: "bg-violet-50 border-violet-200 text-violet-800",
    activeCls: "ring-1 ring-violet-200 shadow-sm",
  },
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

        // ✅ baseCls SIEMPRE aplica (pastel)
        // ✅ activo refuerza
        const cls = [
          "rounded-full border px-4 py-2 text-sm transition",
          "hover:opacity-95",
          t.baseCls,
          isActive ? `font-semibold ${t.activeCls}` : "opacity-95",
        ].join(" ");

        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onClickTab(t.key)}
            className={cls}
            aria-current={isActive ? "page" : undefined}
            title={t.label}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}