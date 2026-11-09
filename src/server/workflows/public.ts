/**
 * Public (buyer-facing) workflows: test-drive booking, enquiry, opt-out.
 * Inputs arrive already validated by the contract Zod schemas.
 */
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { ApiErr, badRequest } from "@/lib/security/errors";
import { assignLead } from "@/server/services/assignment";
import { makeReference } from "@/server/services/ids";
import { isValidSlotStart, SLOT_MINUTES } from "@/server/services/slots";
import type {
  LeadCreated,
  LeadCreateSchema,
  TestDriveCreated,
  TestDriveCreateSchema,
} from "@/types/contracts";
import { enquiryAckBody, sendMock, testDriveAckBody } from "./messaging";

type Tx = Prisma.TransactionClient;

/**
 * A fresh, consented form submission is a new explicit request to be contacted, so it lifts an
 * earlier opt-out for that phone (DPDP: consent can be given again). Recorded on the new lead's timeline.
 */
async function resubscribeIfOptedOut(tx: Tx, phone: string): Promise<boolean> {
  const { count } = await tx.optOut.deleteMany({ where: { phone } });
  return count > 0;
}

function isUniqueOn(e: unknown, field: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  const target = ([] as string[]).concat((e.meta?.target as string[] | string | undefined) ?? []);
  return target.some((t) => t.includes(field));
}

export async function bookTestDrive(
  input: z.output<typeof TestDriveCreateSchema>,
): Promise<TestDriveCreated> {
  const slotStart = new Date(input.slotStart);
  const [showroom, demoCar] = await Promise.all([
    db.showroom.findUnique({
      where: { id: input.showroomId },
      select: { id: true, name: true, openHour: true, closeHour: true, cityId: true },
    }),
    db.demoCar.findUnique({
      where: { id: input.demoCarId },
      select: {
        id: true,
        label: true,
        isActive: true,
        showroomId: true,
        variant: { select: { id: true, modelId: true, isActive: true } },
      },
    }),
  ]);
  if (!showroom) throw badRequest("Showroom not found", { showroomId: "Choose a showroom" });
  if (
    !demoCar ||
    !demoCar.isActive ||
    !demoCar.variant.isActive ||
    demoCar.showroomId !== showroom.id
  ) {
    throw badRequest("That car is not available at this showroom", {
      demoCarId: "Choose a car at this showroom",
    });
  }
  if (
    !isValidSlotStart({ slotStart, openHour: showroom.openHour, closeHour: showroom.closeHour })
  ) {
    throw new ApiErr(
      400,
      "SLOT_INVALID",
      "That time slot is not available. Please pick another slot.",
      {
        slotStart: "Pick a slot from the list",
      },
    );
  }
  const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60_000);
  const now = new Date();
  const reference = makeReference("TD");

  try {
    return await db.$transaction(async (tx) => {
      const resubscribed = await resubscribeIfOptedOut(tx, input.phone);
      const lead = await tx.lead.create({
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email ?? null,
          source: "TEST_DRIVE",
          status: "TEST_DRIVE_BOOKED",
          locale: input.locale,
          interestModelId: demoCar.variant.modelId,
          interestVariantId: demoCar.variant.id,
          showroomId: showroom.id,
          consent: true,
          consentAt: now,
        },
      });
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "CREATED",
          note: "Lead created from online test-drive booking",
        },
      });
      if (resubscribed) {
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "NOTE",
            note: "Earlier opt-out lifted: buyer gave fresh consent on this form",
          },
        });
      }

      const booking = await tx.testDriveBooking.create({
        data: {
          reference,
          demoCarId: demoCar.id,
          showroomId: showroom.id,
          slotStart,
          slotEnd,
          leadId: lead.id,
        },
      });
      const assignee = await assignLead(tx, lead.id, showroom.id, demoCar.variant.modelId);

      const body = testDriveAckBody({
        locale: input.locale,
        name: input.name,
        reference,
        slotStart,
        showroomName: showroom.name,
        carLabel: demoCar.label,
      });
      await sendMock(
        { leadId: lead.id, channel: "WHATSAPP", to: input.phone, template: "test_drive_ack", body },
        tx,
      );
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "TEST_DRIVE_BOOKED",
          note: `Test drive ${reference}: ${demoCar.label}, ${slotStart.toISOString()}`,
        },
      });

      return {
        bookingId: booking.id,
        reference,
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
        showroomName: showroom.name,
        carLabel: demoCar.label,
        consultantName: assignee?.name ?? null,
        acknowledgement: { channel: "WHATSAPP" as const, body },
      };
    });
  } catch (e) {
    // The (demoCarId, slotStart) unique index is the real double-booking guard.
    if (isUniqueOn(e, "slotStart") || isUniqueOn(e, "demoCarId")) {
      throw new ApiErr(
        409,
        "SLOT_TAKEN",
        "Sorry, someone just booked that slot. Please pick another.",
      );
    }
    throw e;
  }
}

export async function createEnquiry(
  input: z.output<typeof LeadCreateSchema>,
): Promise<LeadCreated> {
  // Resolve and sanity-check referenced catalogue rows (never trust client ids).
  let interestModelId = input.interestModelId ?? null;
  const interestVariantId = input.interestVariantId ?? null;
  const fields: Record<string, string> = {};
  if (interestVariantId) {
    const v = await db.variant.findUnique({
      where: { id: interestVariantId },
      select: { modelId: true },
    });
    if (!v) fields.interestVariantId = "Unknown variant";
    else interestModelId = v.modelId;
  }
  if (interestModelId && !fields.interestVariantId) {
    const m = await db.model.findUnique({ where: { id: interestModelId }, select: { id: true } });
    if (!m) fields.interestModelId = "Unknown model";
  }
  if (input.interestUsedCarId) {
    const u = await db.usedCar.findUnique({
      where: { id: input.interestUsedCarId },
      select: { id: true },
    });
    if (!u) fields.interestUsedCarId = "Unknown used car";
  }
  if (input.showroomId) {
    const s = await db.showroom.findUnique({
      where: { id: input.showroomId },
      select: { id: true },
    });
    if (!s) fields.showroomId = "Unknown showroom";
  }
  if (Object.keys(fields).length) throw badRequest("Please check the highlighted fields", fields);

  const reference = makeReference("EN");
  const now = new Date();
  return db.$transaction(async (tx) => {
    const resubscribed = await resubscribeIfOptedOut(tx, input.phone);
    const lead = await tx.lead.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        source: "WEB",
        status: "NEW",
        locale: input.locale,
        interestModelId,
        interestVariantId,
        interestUsedCarId: input.interestUsedCarId ?? null,
        showroomId: input.showroomId ?? null,
        citySlug: input.citySlug ?? null,
        message: input.message || null,
        consent: true,
        consentAt: now,
      },
    });
    await tx.leadActivity.create({
      data: { leadId: lead.id, type: "CREATED", note: `Website enquiry ${reference}` },
    });
    if (resubscribed) {
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "NOTE",
          note: "Earlier opt-out lifted: buyer gave fresh consent on this form",
        },
      });
    }
    // Model for model-aware assignment: explicit/variant model, else a used car's model by name.
    let assignModelId = interestModelId;
    if (!assignModelId && input.interestUsedCarId) {
      const used = await tx.usedCar.findUnique({
        where: { id: input.interestUsedCarId },
        select: { modelName: true },
      });
      if (used) {
        const m = await tx.model.findFirst({
          where: { name: { equals: used.modelName, mode: "insensitive" } },
          select: { id: true },
        });
        assignModelId = m?.id ?? null;
      }
    }
    await assignLead(tx, lead.id, input.showroomId ?? null, assignModelId);
    await sendMock(
      {
        leadId: lead.id,
        channel: "WHATSAPP",
        to: input.phone,
        template: "enquiry_ack",
        body: enquiryAckBody({ locale: input.locale, name: input.name, reference }),
      },
      tx,
    );
    return { leadId: lead.id, reference };
  });
}

/** DPDP opt-out. Idempotent and silent about whether the phone exists. */
export async function optOut(phone: string): Promise<{ ok: true }> {
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.optOut.upsert({ where: { phone }, update: {}, create: { phone } });
    const leads = await tx.lead.findMany({
      where: { phone, optedOut: false },
      select: { id: true },
    });
    if (leads.length === 0) return;
    await tx.lead.updateMany({
      where: { id: { in: leads.map((l) => l.id) } },
      data: { optedOut: true, optedOutAt: now },
    });
    await tx.leadActivity.createMany({
      data: leads.map((l) => ({
        leadId: l.id,
        type: "OPTED_OUT",
        note: "Buyer opted out of messages (opt-out page)",
      })),
    });
  });
  return { ok: true };
}
