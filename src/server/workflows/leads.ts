/**
 * Staff lead workflows. Every function takes the signed-in user and enforces ownership itself:
 * a CONSULTANT may only see/modify leads assigned to them; an ADMIN may see/modify all.
 */
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "@/lib/security/errors";
import type { SessionUser } from "@/lib/security/guard";
import { findDiscountLanguage } from "@/server/ai/guardrails";
import { OPEN_LEAD_STATUSES } from "@/server/services/assignment";
import { maskPhone } from "@/server/services/mask";
import { slaState } from "@/server/services/sla";
import {
  AiSummarySchema,
  type AiDraftResult,
  type AiSummaryResult,
  type ConsultantOption,
  type LeadContactSchema,
  type LeadDetail,
  type LeadListItem,
  type LeadListQuerySchema,
  type LeadPatch,
  type Locale,
  type SendResult,
  type SendSchema,
} from "@/types/contracts";
import { sendMock } from "./messaging";

const listSelect = {
  id: true,
  name: true,
  phone: true,
  source: true,
  status: true,
  createdAt: true,
  firstContactAt: true,
  optedOut: true,
  assignedTo: { select: { id: true, name: true } },
  showroom: { select: { name: true } },
  interestModel: { select: { name: true } },
  interestVariant: { select: { name: true, model: { select: { name: true } } } },
  interestUsedCar: { select: { stockId: true, modelName: true } },
  portalName: true,
} satisfies Prisma.LeadSelect;

type ListRow = Prisma.LeadGetPayload<{ select: typeof listSelect }>;

function interestLabel(l: ListRow): string | null {
  if (l.interestUsedCar) return `Used: ${l.interestUsedCar.stockId} ${l.interestUsedCar.modelName}`;
  if (l.interestVariant) return `${l.interestVariant.model.name} ${l.interestVariant.name}`;
  if (l.interestModel) return l.interestModel.name;
  return null;
}

function toListItem(l: ListRow, now: Date): LeadListItem {
  return {
    id: l.id,
    name: l.name,
    phoneMasked: maskPhone(l.phone),
    source: l.source,
    status: l.status,
    interest: interestLabel(l),
    showroomName: l.showroom?.name ?? null,
    assignedTo: l.assignedTo,
    createdAt: l.createdAt.toISOString(),
    firstContactAt: l.firstContactAt?.toISOString() ?? null,
    sla: slaState(l.createdAt, l.firstContactAt, now),
    optedOut: l.optedOut,
    portalName: l.portalName ?? null,
  };
}

/** 404 if missing, 403 if a consultant asks for someone else's lead. */
export async function assertLeadAccess(user: SessionUser, leadId: string) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { id: true, assignedToId: true },
  });
  if (!lead) throw notFound("Lead not found");
  if (user.role === "ADMIN") return lead;
  if (user.role === "CONSULTANT" && lead.assignedToId === user.id) return lead;
  throw forbidden("This lead is assigned to another consultant");
}

export async function listLeads(
  user: SessionUser,
  query: z.output<typeof LeadListQuerySchema>,
): Promise<LeadListItem[]> {
  const where: Prisma.LeadWhereInput = {};
  // Consultants only ever see their own leads, whatever scope they ask for.
  if (user.role !== "ADMIN" || query.scope === "mine") where.assignedToId = user.id;
  if (query.status) where.status = query.status;

  const rows = await db.lead.findMany({
    where,
    select: listSelect,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const now = new Date();
  const items = rows.map((r) => toListItem(r, now));
  return query.sla ? items.filter((i) => i.sla === query.sla) : items;
}

function toSummaryResult(row: {
  id: string;
  status: AiSummaryResult["status"];
  reason: string | null;
  output: Prisma.JsonValue;
  model: string;
  createdAt: Date;
}): AiSummaryResult | null {
  const out = row.output as Record<string, unknown> | null;
  const parsed = AiSummarySchema.safeParse(out && "summary" in out ? out.summary : out);
  if (!parsed.success) return null;
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    summary: parsed.data,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDraftResult(
  row: {
    id: string;
    status: AiDraftResult["status"];
    reason: string | null;
    input: Prisma.JsonValue;
    output: Prisma.JsonValue;
    model: string;
    createdAt: Date;
  },
  fallbackLocale: Locale,
): AiDraftResult | null {
  const out = row.output as Record<string, unknown> | null;
  const text = typeof out?.text === "string" ? out.text : null;
  if (!text) return null;
  const inLocale = (row.input as Record<string, unknown> | null)?.locale;
  const locale: Locale = inLocale === "hi" || inLocale === "en" ? inLocale : fallbackLocale;
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    text,
    locale,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Builds the detail DTO without an access check — callers must check first. */
async function buildLeadDetail(leadId: string): Promise<LeadDetail> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      ...listSelect,
      email: true,
      locale: true,
      message: true,
      citySlug: true,
      consent: true,
      consentAt: true,
      interestModelId: true,
      interestVariantId: true,
      interestUsedCarId: true,
      showroomId: true,
      activities: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          note: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      },
      bookings: {
        orderBy: { slotStart: "asc" },
        select: {
          id: true,
          reference: true,
          slotStart: true,
          status: true,
          demoCar: { select: { label: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, channel: true, body: true, createdAt: true },
      },
    },
  });
  if (!lead) throw notFound("Lead not found");

  const aiSelect = {
    id: true,
    status: true,
    reason: true,
    input: true,
    output: true,
    model: true,
    createdAt: true,
  } as const;
  const [summaryRow, draftRow] = await Promise.all([
    db.aiOutput.findFirst({
      where: { leadId, kind: "SUMMARY" },
      orderBy: { createdAt: "desc" },
      select: aiSelect,
    }),
    db.aiOutput.findFirst({
      where: { leadId, kind: "DRAFT" },
      orderBy: { createdAt: "desc" },
      select: aiSelect,
    }),
  ]);

  return {
    ...toListItem(lead, new Date()),
    phone: lead.phone,
    email: lead.email,
    locale: lead.locale,
    message: lead.message,
    citySlug: lead.citySlug,
    consent: lead.consent,
    consentAt: lead.consentAt?.toISOString() ?? null,
    interestModelId: lead.interestModelId,
    interestVariantId: lead.interestVariantId,
    interestUsedCarId: lead.interestUsedCarId,
    showroomId: lead.showroomId,
    activities: lead.activities.map((a) => ({
      id: a.id,
      type: a.type,
      note: a.note,
      actorName: a.actor?.name ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    bookings: lead.bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      slotStart: b.slotStart.toISOString(),
      carLabel: b.demoCar.label,
      status: b.status,
    })),
    latestSummary: summaryRow ? toSummaryResult(summaryRow) : null,
    latestDraft: draftRow ? toDraftResult(draftRow, lead.locale) : null,
    messages: lead.messages.map((m) => ({
      id: m.id,
      channel: m.channel,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function getLeadDetail(user: SessionUser, leadId: string): Promise<LeadDetail> {
  await assertLeadAccess(user, leadId);
  return buildLeadDetail(leadId);
}

export async function updateLead(
  user: SessionUser,
  leadId: string,
  patch: LeadPatch,
): Promise<LeadDetail> {
  await assertLeadAccess(user, leadId);
  const current = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { status: true, assignedToId: true, assignedTo: { select: { name: true } } },
  });

  let target: { id: string; name: string } | null = null;
  if (patch.assignedToId && patch.assignedToId !== current.assignedToId) {
    target = await db.user.findFirst({
      where: { id: patch.assignedToId, isActive: true, role: { in: ["CONSULTANT", "ADMIN"] } },
      select: { id: true, name: true },
    });
    if (!target) {
      throw badRequest("Pick an active consultant", { assignedToId: "Pick an active consultant" });
    }
  }

  await db.$transaction(async (tx) => {
    if (patch.status && patch.status !== current.status) {
      await tx.lead.update({ where: { id: leadId }, data: { status: patch.status } });
      await tx.leadActivity.create({
        data: {
          leadId,
          actorId: user.id,
          type: "STATUS_CHANGED",
          note: `Status changed from ${statusLabel(current.status)} to ${statusLabel(patch.status)}`,
        },
      });
    }
    if (target) {
      await tx.lead.update({ where: { id: leadId }, data: { assignedToId: target.id } });
      await tx.user.update({ where: { id: target.id }, data: { lastAssignedAt: new Date() } });
      const from = current.assignedTo?.name ?? "unassigned";
      await tx.leadActivity.create({
        data: {
          leadId,
          actorId: user.id,
          type: "REASSIGNED",
          note: `Reassigned from ${from} to ${target.name}${patch.note ? `: ${patch.note}` : ""}`,
        },
      });
    } else if (patch.note) {
      await tx.leadActivity.create({
        data: { leadId, actorId: user.id, type: "NOTE", note: patch.note },
      });
    }
  });

  // After a reassignment the consultant no longer owns the lead; still return the result of their action.
  return buildLeadDetail(leadId);
}

export async function markContacted(
  user: SessionUser,
  leadId: string,
  input: z.output<typeof LeadContactSchema>,
): Promise<LeadDetail> {
  await assertLeadAccess(user, leadId);
  await db.$transaction(async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: { status: true, firstContactAt: true },
    });
    await tx.lead.update({
      where: { id: leadId },
      data: {
        firstContactAt: lead.firstContactAt ?? new Date(),
        ...(lead.status === "NEW" ? { status: "CONTACTED" as const } : {}),
      },
    });
    await tx.leadActivity.create({
      data: { leadId, actorId: user.id, type: "CONTACTED", note: input.note || "Called the buyer" },
    });
  });
  return buildLeadDetail(leadId);
}

export async function sendMessage(
  user: SessionUser,
  leadId: string,
  input: z.output<typeof SendSchema>,
): Promise<SendResult> {
  await assertLeadAccess(user, leadId);

  if (input.aiOutputId) {
    const ai = await db.aiOutput.findFirst({
      where: { id: input.aiOutputId, leadId, kind: "DRAFT" },
      select: { id: true },
    });
    if (!ai) throw badRequest("Draft not found for this lead", { aiOutputId: "Unknown draft" });
  }
  // Brief: AI drafts never quote discounts. When a draft is being sent, the edited text is checked again here.
  const discount = input.aiOutputId ? findDiscountLanguage(input.text) : [];
  if (discount.length > 0) {
    throw badRequest(
      "Remove discount or offer wording before sending — discounts are discussed in person only.",
      {
        text: `Contains: ${discount.join(", ")}`,
      },
    );
  }

  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: { phone: true, status: true, firstContactAt: true },
    });
    const msg = await sendMock(
      {
        leadId,
        channel: input.channel,
        to: lead.phone,
        template: input.aiOutputId ? "ai_draft_reviewed" : "consultant_message",
        body: input.text,
      },
      tx,
    );
    if (input.aiOutputId) {
      await tx.aiOutput.update({
        where: { id: input.aiOutputId },
        data: { editedText: input.text, sentAt: msg.createdAt },
      });
    }
    await tx.lead.update({
      where: { id: leadId },
      data: {
        firstContactAt: lead.firstContactAt ?? msg.createdAt,
        ...(lead.status === "NEW" ? { status: "CONTACTED" as const } : {}),
      },
    });
    await tx.leadActivity.create({
      data: {
        leadId,
        actorId: user.id,
        type: "MESSAGE_SENT",
        note: `${input.channel === "SMS" ? "SMS" : "WhatsApp"} sent${input.aiOutputId ? " (reviewed AI draft)" : ""}`,
      },
    });
    return { messageId: msg.id, sentAt: msg.createdAt.toISOString() };
  });
}

/** Active consultants (and admins, the lead desk) a lead can be reassigned to. */
export async function listConsultants(): Promise<ConsultantOption[]> {
  const users = await db.user.findMany({
    where: { isActive: true, role: { in: ["CONSULTANT", "ADMIN"] } },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      role: true,
      showroom: { select: { name: true } },
      _count: { select: { assignedLeads: { where: { status: { in: [...OPEN_LEAD_STATUSES] } } } } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    showroomName: u.role === "ADMIN" ? "Lead desk" : (u.showroom?.name ?? null),
    openLeads: u._count.assignedLeads,
  }));
}

/** Human-readable status for timeline notes, e.g. TEST_DRIVE_BOOKED → "Test drive booked". */
function statusLabel(status: string): string {
  const s = status.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
