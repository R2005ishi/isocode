import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/types/contracts";
import { STATUS_LABEL } from "../labels";

const DOT: Record<LeadStatus, string> = {
  NEW: "bg-sky-500",
  CONTACTED: "bg-indigo-500",
  TEST_DRIVE_BOOKED: "bg-violet-500",
  NEGOTIATION: "bg-amber-500",
  WON: "bg-emerald-600",
  LOST: "bg-zinc-400",
};

/** Neutral pill with a coloured dot — the label carries the meaning. */
export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full border bg-background px-2 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[status])} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
