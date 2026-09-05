import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { ArrowsClockwise, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface EmptyStateProps {
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="reveal flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-6 text-muted-foreground" weight="duotone" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Terjadi kesalahan", message, onRetry }: ErrorStateProps) {
  return (
    <div className="reveal rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
      <WarningCircle className="mx-auto size-8 text-rose-600" weight="duotone" />
      <h3 className="mt-3 text-base font-semibold text-rose-900">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-lg break-words text-sm leading-relaxed text-rose-800/90">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <ArrowsClockwise className="size-3.5" />
          Coba lagi
        </Button>
      )}
    </div>
  );
}

export function LoadingSection({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={`row-${i}`} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
