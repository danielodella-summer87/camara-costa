import { cn } from "@/lib/utils";

type Gap = "xs" | "sm" | "md" | "lg" | "xl";

const gapClass: Record<Gap, string> = {
  xs: "gap-1",  // 4px
  sm: "gap-2",  // 8px
  md: "gap-3",  // 12px
  lg: "gap-4",  // 16px
  xl: "gap-6",  // 24px
};

export function Stack({
  children,
  className,
  gap = "md",
}: {
  children: React.ReactNode;
  className?: string;
  gap?: Gap;
}) {
  return <div className={cn("flex flex-col", gapClass[gap], className)}>{children}</div>;
}