/**
 * Lead auto-assignment.
 * ASSUMPTION: pools in priority order — (1) same showroom AND specialises in the lead's model,
 * (2) same showroom, (3) any consultant specialising in the model, (4) any consultant.
 * Within a pool: fewest open leads; tie → longest since last assignment (never assigned counts as
 * oldest); tie → id. A consultant with no specialty models is a generalist: eligible for showroom
 * pools but never counted as a model match. If no consultant at all → an admin (the lead desk).
 */
import type { Prisma } from "@prisma/client";

/** ASSUMPTION: "open" lead = NEW, CONTACTED, TEST_DRIVE_BOOKED or NEGOTIATION. */
export const OPEN_LEAD_STATUSES = ["NEW", "CONTACTED", "TEST_DRIVE_BOOKED", "NEGOTIATION"] as const;

export type AssignmentCandidate = {
  id: string;
  showroomId: string | null;
  openLeads: number;
  lastAssignedAt: Date | null;
  /** Model ids this consultant specialises in; empty = generalist. */
  specialtyModelIds?: string[];
};

function compare(a: AssignmentCandidate, b: AssignmentCandidate): number {
  if (a.openLeads !== b.openLeads) return a.openLeads - b.openLeads;
  const ta = a.lastAssignedAt ? a.lastAssignedAt.getTime() : -Infinity;
  const tb = b.lastAssignedAt ? b.lastAssignedAt.getTime() : -Infinity;
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // deterministic final tie-break
}

export function pickConsultant(
  candidates: AssignmentCandidate[],
  showroomId: string | null,
  modelId?: string | null,
): string | null {
  if (candidates.length === 0) return null;
  const local = showroomId ? candidates.filter((c) => c.showroomId === showroomId) : [];
  const isSpecialist = (c: AssignmentCandidate) =>
    !!modelId && (c.specialtyModelIds ?? []).includes(modelId);
  const pools = [local.filter(isSpecialist), local, candidates.filter(isSpecialist), candidates];
  const pool = pools.find((p) => p.length > 0)!;
  return [...pool].sort(compare)[0]!.id;
}

/**
 * Assigns a lead inside the caller's transaction. Returns the assignee, or null if there is
 * no active consultant or admin at all (lead stays unassigned).
 */
export async function assignLead(
  tx: Prisma.TransactionClient,
  leadId: string,
  showroomId: string | null,
  modelId?: string | null,
): Promise<{ id: string; name: string } | null> {
  const consultants = await tx.user.findMany({
    where: { role: "CONSULTANT", isActive: true },
    select: {
      id: true,
      name: true,
      showroomId: true,
      lastAssignedAt: true,
      specialtyModelIds: true,
      _count: { select: { assignedLeads: { where: { status: { in: [...OPEN_LEAD_STATUSES] } } } } },
    },
  });

  const pickedId = pickConsultant(
    consultants.map((c) => ({
      id: c.id,
      showroomId: c.showroomId,
      openLeads: c._count.assignedLeads,
      lastAssignedAt: c.lastAssignedAt,
      specialtyModelIds: c.specialtyModelIds ?? [],
    })),
    showroomId,
    modelId ?? null,
  );

  let assignee: { id: string; name: string } | null = null;
  if (pickedId) {
    const c = consultants.find((u) => u.id === pickedId)!;
    assignee = { id: c.id, name: c.name };
  } else {
    assignee = await tx.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
  }
  if (!assignee) return null;

  const now = new Date();
  await tx.lead.update({ where: { id: leadId }, data: { assignedToId: assignee.id } });
  await tx.user.update({ where: { id: assignee.id }, data: { lastAssignedAt: now } });
  await tx.leadActivity.create({
    data: { leadId, type: "ASSIGNED", note: `Auto-assigned to ${assignee.name}` },
  });
  return assignee;
}
