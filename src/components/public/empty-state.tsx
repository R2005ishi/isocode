import { SearchXIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  icon: Icon = SearchXIcon,
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="font-heading text-lg font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
