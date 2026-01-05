"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AreaKey, areaLabel, getAreaColors } from "./areaColors";

export type AreaTab = {
  area: AreaKey;
  href: string; // puede incluir query (?area=...)
  label?: string;
  exact?: boolean; // si false, activa por startsWith
};

function isActivePath(pathname: string, href: string, exact?: boolean) {
  const url = new URL(href, "http://local");
  const targetPath = url.pathname;
  if (exact) return pathname === targetPath;
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

export function AreaTabs({
  tabs,
  className,
  queryKey = "area",
}: {
  tabs: AreaTab[];
  className?: string;
  queryKey?: string;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const currentArea = (sp.get(queryKey) as AreaKey | null) ?? "resumen";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const colors = getAreaColors(t.area);
          const active =
            currentArea === t.area ||
            isActivePath(pathname, t.href, t.exact);

          return (
            <Link
              key={t.area}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="rounded-full border px-4 py-2 text-sm transition hover:brightness-[0.98]"
              style={{
                backgroundColor: active ? colors.activeBg : colors.bg,
                borderColor: active ? colors.activeBorder : colors.border,
                color: active ? colors.activeText : colors.text,
              }}
              title={t.label ?? areaLabel(t.area)}
            >
              {t.label ?? areaLabel(t.area)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}