/**
 * Missed-SLA escalation sweep (rules in services/escalation.ts).
 *
 * Triggers, so it works without extra infrastructure and also on a schedule:
 *   - the staff inbox calls `maybeRunEscalations()` on every poll (throttled per server process);
 *   - `GET /api/cron/escalate` (Bearer CRON_SECRET) for an external scheduler.
 * Each lead is claimed with a conditional update, so two sweeps running at once never escalate
 * the same lead twice.
 */
import { db } from "@/lib/db";
import { assignLead } from "@/server/services/assignment";
import {
  ESCALATE_REASSIGN_MS,
  MAX_ESCALATION_LEVEL,
  minutesSince,
  nextEscalationLevel,
} from "@/server/services/escalation";
import { sendMock } from "./messaging";

export type EscalationRun = { checked: number; reassigned: number; deskAlerts: number };

/** Staff alerts are internal: written to the mock log without a leadId (buyer opt-out doesn't apply). */
async function alertStaff(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  phones: string[],
  template: string,
  body: string,
) {
  for (const to of phones) await sendMock({ leadId: null, channel: "SMS", to, template, body }, tx);
}

export async function runEscalations(now: Date = new Date(), limit = 100): Promise<EscalationRun> {
  const due = await db.lead.findMany({
    where: {
      status: "NEW",
      firstContactAt: null,
      escalationLevel: { lt: MAX_ESCALATION_LEVEL },
      createdAt: { lte: new Date(now.getTime() - ESCALATE_REASSIGN_MS) },
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      firstContactAt: true,
      escalationLevel: true,
      showroomId: true,
      interestModelId: true,
      interestVariant: { select: { modelId: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const run: EscalationRun = { checked: due.length, reassigned: 0, deskAlerts: 0 };
  if (due.length === 0) return run;

  const desk = await db.user.findMany({
    where: { role: "ADMIN", isActive: true, phone: { not: null } },
    select: { phone: true },
  });
  const deskPhones = desk.map((d) => d.phone!).filter(Boolean);

  for (const lead of due) {
    const level = nextEscalationLevel(lead, now);
    if (!level) continue;
    const waited = minutesSince(lead.createdAt, now);
    const from = lead.assignedTo?.name ?? "nobody";

    await db.$transaction(async (tx) => {
      // Claim: only proceeds if nobody contacted or escalated the lead since we read it.
      const claimed = await tx.lead.updateMany({
        where: { id: lead.id, status: "NEW", firstContactAt: null, escalationLevel: lead.escalationLevel },
        data: { escalationLevel: level, escalatedAt: now },
      });
      if (claimed.count === 0) return;

      if (level === 1) {
        const assignee = await assignLead(
          tx,
          lead.id,
          lead.showroomId,
          lead.interestModelId ?? lead.interestVariant?.modelId ?? null,
          {
            excludeUserIds: lead.assignedTo ? [lead.assignedTo.id] : [],
            activityType: "REASSIGNED",
            note: (to) => `Not contacted within 5 minutes (${waited}). Reassigned from ${from} to ${to}.`,
          },
        );
        if (assignee) {
          const newOwner = await tx.user.findUnique({ where: { id: assignee.id }, select: { phone: true } });
          if (newOwner?.phone) {
            await alertStaff(
              tx,
              [newOwner.phone],
              "lead_reassigned",
              `Urgent lead: ${lead.name} has waited ${waited} without a call. It is now yours — please call now.`,
            );
          }
        }
        await alertStaff(
          tx,
          deskPhones,
          "lead_desk_escalation",
          `Lead desk: ${lead.name} missed the 5-min call target with ${from}; reassigned to ${assignee?.name ?? "nobody (no active staff)"}.`,
        );
        run.reassigned++;
      } else {
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "ESCALATED",
            note: `Still not contacted after ${waited}. Lead desk alerted again.`,
          },
        });
        await alertStaff(
          tx,
          deskPhones,
          "lead_desk_escalation_2",
          `Lead desk: ${lead.name} still not called after ${waited} (assigned to ${from}). Please call directly.`,
        );
      }
      run.deskAlerts++;
    });
  }
  return run;
}

/** ASSUMPTION: inbox polls trigger at most one sweep every 20 s per server process. */
const SWEEP_EVERY_MS = 20_000;
let lastSweep = 0;
let running: Promise<unknown> | null = null;

/** Throttled, failure-tolerant sweep for request paths: escalation must never break the inbox. */
export async function maybeRunEscalations(now: Date = new Date()): Promise<void> {
  // Tests that assert fixed lead ownership turn the poll trigger off; the cron route still works.
  if (process.env.ESCALATION_ON_POLL === "off") return;
  if (running || now.getTime() - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now.getTime();
  running = runEscalations(now)
    .catch((e) => console.error("[escalation] sweep failed", e))
    .finally(() => {
      running = null;
    });
  await running;
}
