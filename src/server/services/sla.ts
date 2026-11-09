/**
 * Lead first-response SLA. [client-safe] — the inbox timer ticks on the client with these.
 */
import type { SlaState } from "@/types/contracts";

/** 5-minute first-response target, from the brief's success metric. */
export const SLA_MS = 5 * 60_000;
/** ASSUMPTION: the timer chip turns amber at 3 minutes. */
export const SLA_AMBER_MS = 3 * 60_000;

function toMs(d: Date | string): number {
  return (typeof d === "string" ? new Date(d) : d).getTime();
}

/**
 * Not yet contacted: < 3m GREEN, 3m..<5m AMBER, ≥ 5m RED.
 * Contacted: within 5m (inclusive) MET, otherwise BREACHED.
 */
export function slaState(
  createdAt: Date | string,
  firstContactAt: Date | string | null,
  now: Date = new Date(),
): SlaState {
  const created = toMs(createdAt);
  if (firstContactAt !== null && firstContactAt !== undefined) {
    return toMs(firstContactAt) - created <= SLA_MS ? "MET" : "BREACHED";
  }
  const elapsed = now.getTime() - created;
  if (elapsed >= SLA_MS) return "RED";
  if (elapsed >= SLA_AMBER_MS) return "AMBER";
  return "GREEN";
}

/** Milliseconds left until the 5-minute deadline; negative once overdue. */
export function slaRemainingMs(createdAt: Date | string, now: Date = new Date()): number {
  return toMs(createdAt) + SLA_MS - now.getTime();
}
