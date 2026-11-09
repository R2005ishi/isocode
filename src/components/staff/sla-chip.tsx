"use client";

import { useEffect, useState } from "react";
import { AlarmClockIcon, CircleAlertIcon, CircleCheckIcon, HourglassIcon, TimerIcon, SirenIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { slaRemainingMs, slaState } from "@/server/services/sla";
import type { SlaState } from "@/types/contracts";
import { formatDuration } from "./labels";

/** Current time, re-rendering every `intervalMs`. Use once per screen and pass `now` down. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Live SLA state for a lead, computed client-side from the same function the server uses. */
export function liveSla(
  lead: { createdAt: string; firstContactAt: string | null },
  now: number,
): SlaState {
  return slaState(lead.createdAt, lead.firstContactAt, new Date(now));
}

const STYLE: Record<SlaState, { cls: string; Icon: typeof TimerIcon }> = {
  GREEN: {
    cls: "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    Icon: TimerIcon,
  },
  AMBER: {
    cls: "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
    Icon: HourglassIcon,
  },
  RED: {
    cls: "border-red-600/40 bg-red-600 text-white dark:bg-red-700",
    Icon: AlarmClockIcon,
  },
  MET: {
    cls: "border-border bg-muted text-muted-foreground",
    Icon: CircleCheckIcon,
  },
  BREACHED: {
    cls: "border-red-600/25 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
    Icon: CircleAlertIcon,
  },
};

export function slaText(
  state: SlaState,
  lead: { createdAt: string; firstContactAt: string | null },
  now: number,
): string {
  const remaining = slaRemainingMs(lead.createdAt, new Date(now));
  const responded = lead.firstContactAt
    ? new Date(lead.firstContactAt).getTime() - new Date(lead.createdAt).getTime()
    : 0;
  switch (state) {
    case "GREEN":
    case "AMBER":
      return `${formatDuration(remaining)} left`;
    case "RED":
      return `Overdue ${formatDuration(remaining)}`;
    case "MET":
      return `Met · ${formatDuration(responded)}`;
    case "BREACHED":
      return `Late · ${formatDuration(responded)}`;
  }
}

const A11Y: Record<SlaState, string> = {
  GREEN: "Within 5-minute response window",
  AMBER: "Response window closing",
  RED: "5-minute response window missed — not yet contacted",
  MET: "First contact within 5 minutes",
  BREACHED: "First contact after 5 minutes",
};

/** Colour + icon + text, so the state never relies on colour alone. */
export function SlaChip({
  lead,
  now,
  className,
}: {
  lead: { createdAt: string; firstContactAt: string | null };
  now: number;
  className?: string;
}) {
  const state = liveSla(lead, now);
  const { cls, Icon } = STYLE[state];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium tabular-nums whitespace-nowrap",
        cls,
        className,
      )}
      title={A11Y[state]}
      data-sla={state}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{A11Y[state]}: </span>
      {slaText(state, lead, now)}
    </span>
  );
}

/** Shown beside the SLA chip once a lead has been escalated for missing the 5-minute target. */
export function EscalatedBadge({ level, className }: { level?: number; className?: string }) {
  if (!level) return null;
  const label = level >= 2 ? "Escalated · desk alerted" : "Escalated · reassigned";
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-red-600/25 bg-red-50 px-2 text-xs font-medium whitespace-nowrap text-red-800 dark:bg-red-950/40 dark:text-red-300",
        className,
      )}
      title="Missed the 5-minute call target and was escalated automatically"
    >
      <SirenIcon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
