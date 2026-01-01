import { cn } from "@/lib/utils";

export function Grid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 md:gap-6", className)}>{children}</div>;
}