import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
  index?: number;
}

export function Stat({ label, value, sub, className, index = 0 }: StatProps) {
  return (
    <div
      className={cn("reveal rounded-xl border border-border bg-card px-5 py-4", className)}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
