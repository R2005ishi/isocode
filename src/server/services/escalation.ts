/**
 * Missed-SLA escalation rules. [client-safe] — pure, no db.
 *
 * The brief's success metric is "90 % of web leads called within 5 minutes". A timer alone
 * only shows the miss; escalation acts on it:
 *   level 1 — not contacted 5 min after creation → reassign to the next-best consultant
 *             (never the same person) and alert the lead desk.
 *   level 2 — still not contacted 10 min after creation → alert the lead desk again; no
 *             further reassignment (bouncing a lead around helps nobody).
 * Only NEW leads with no first contact escalate; any contact or status change stops it.
 */
import { SLA_MS } from "./sla";

/** Level 1 fires when the 5-minute SLA is missed. */
export const ESCALATE_REASSIGN_MS = SLA_MS;
/** ASSUMPTION: the lead desk gets a second alert at 10 minutes. */
export const ESCALATE_DESK_MS = 10 * 60_000;
export const MAX_ESCALATION_LEVEL = 2;

export type EscalationCandidate = {
  status: string;
  createdAt: Date;
  firstContactAt: Date | null;
  escalationLevel: number;
};

/**
 * The next escalation level this lead should move to now, or null when nothing is due.
 * Levels are applied one at a time: a lead found at 12 minutes that was never escalated is
 * reassigned first (level 1), and gets the second desk alert on a later sweep.
 */
export function nextEscalationLevel(lead: EscalationCandidate, now: Date = new Date()): 1 | 2 | null {
  if (lead.status !== "NEW" || lead.firstContactAt) return null;
  const age = now.getTime() - lead.createdAt.getTime();
  if (lead.escalationLevel <= 0) return age >= ESCALATE_REASSIGN_MS ? 1 : null;
  if (lead.escalationLevel === 1) return age >= ESCALATE_DESK_MS ? 2 : null;
  return null;
}

/** Human-readable minutes for activity notes and alerts, e.g. "7 min". */
export function minutesSince(from: Date, now: Date = new Date()): string {
  return `${Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000))} min`;
}
