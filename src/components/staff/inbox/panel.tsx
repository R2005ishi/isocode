import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Card section used across the lead detail screen. */
export function Panel({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-background", className)}>
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
