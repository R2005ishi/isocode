import { db } from "@/lib/db";
import { slaState } from "@/server/services/sla";

export type SlaDay = {
  date: string; // YYYY-MM-DD (IST)
  label: string; // "7 Nov"
  decided: number; // leads whose 5-minute outcome is known
  met: number;
  pct: number | null; // null when no decided leads that day
};

export type SlaOverview = {
  days: SlaDay[];
  decided: number;
  met: number;
  pct: number | null;
  waitingNow: number;
  overdueNow: number;
  /** Leads auto-escalated for missing the 5-minute target in the window. */
  escalated: number;
  medianResponseMs: number | null;
};

const IST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const IST_LABEL = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

/**
 * Read-only aggregate for the admin overview: share of leads first contacted within 5 minutes,
 * per IST day over the last 30 days. Leads still inside their 5-minute window are not counted yet
 * (their outcome isn't known); uncontacted leads past 5 minutes count as misses.
 */
export async function getSlaOverview(now = new Date(), windowDays = 30): Promise<SlaOverview> {
  const since = new Date(now.getTime() - windowDays * 86_400_000);
  const leads = await db.lead.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, firstContactAt: true, status: true, escalationLevel: true },
  });

  const days: SlaDay[] = [];
  const index = new Map<string, SlaDay>();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const day: SlaDay = { date: IST_DAY.format(d), label: IST_LABEL.format(d), decided: 0, met: 0, pct: null };
    if (!index.has(day.date)) {
      index.set(day.date, day);
      days.push(day);
    }
  }

  let waitingNow = 0;
  let overdueNow = 0;
  let escalated = 0;
  const responses: number[] = [];
  for (const l of leads) {
    if (l.escalationLevel > 0) escalated++;
    const state = slaState(l.createdAt, l.firstContactAt, now);
    const closed = l.status === "WON" || l.status === "LOST";
    if (state === "GREEN" || state === "AMBER") {
      if (!closed) waitingNow++;
      continue;
    }
    if (state === "RED" && !closed) {
      waitingNow++;
      overdueNow++;
    }
    if (l.firstContactAt) responses.push(l.firstContactAt.getTime() - l.createdAt.getTime());
    const day = index.get(IST_DAY.format(l.createdAt));
    if (!day) continue;
    day.decided++;
    if (state === "MET") day.met++;
  }
  for (const d of days) d.pct = d.decided ? Math.round((d.met / d.decided) * 100) : null;

  const decided = days.reduce((n, d) => n + d.decided, 0);
  const met = days.reduce((n, d) => n + d.met, 0);
  responses.sort((a, b) => a - b);
  const medianResponseMs = responses.length ? responses[Math.floor(responses.length / 2)] : null;

  return {
    days,
    decided,
    met,
    pct: decided ? Math.round((met / decided) * 1000) / 10 : null,
    waitingNow,
    overdueNow,
    escalated,
    medianResponseMs,
  };
}
