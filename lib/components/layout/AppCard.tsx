import { cn } from "@/lib/utils";

export function AppCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-background shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}