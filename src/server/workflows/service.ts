/**
 * Service booking by workshop bay capacity: public booking + staff (ADMIN) management.
 * Inputs arrive already validated by the Zod schemas in services/service-slots.ts.
 *
 * Capacity guard: unlike test drives (one car → a unique index), a slot holds `bays` bookings, so
 * there is no unique constraint to lean on. The count-then-insert runs in a SERIALIZABLE
 * transaction; Postgres aborts one of two racing transactions (P2034) and we retry it (jittered), at
 * which point it sees the committed booking and is rejected if the slot is now full.
 */
import { randomInt } from "node:crypto";
import { Prisma, type ServiceBookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiErr, badRequest, notFound } from "@/lib/security/errors";
import { maskRegistration } from "@/server/services/mask";
import {
  countByStart,
  isValidServiceSlotStart,
  SERVICE_SLOT_MINUTES,
  serviceSlotGrid,
  type AdminServiceBooking,
  type PublicWorkshop,
  type ServiceBookingCreated,
  type ServiceBookingInput,
  type ServiceBookingList,
  type ServiceBookingListQuery,
  type ServiceType,
} from "@/server/services/service-slots";
import { REFERENCE_ALPHABET } from "@/server/services/ids";
import { istDayBoundsUtc } from "@/server/services/slots";

/** ASSUMPTION: service references are `SV-` + 5 characters from the same no-0/O/1/I alphabet as TD/EN. */
export function makeServiceReference(): string {
  let s = "";
  for (let i = 0; i < 5; i++) s += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `SV-${s}`;
}

export const SERVICE_REFERENCE_RE = /^SV-[A-Z0-9]{3,12}$/;

export async function listWorkshops(): Promise<PublicWorkshop[]> {
  const rows = await db.workshop.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      bays: true,
      openHour: true,
      closeHour: true,
      showroom: { select: { address: true } },
    },
  });
  return rows.map(({ showroom, ...w }) => ({ ...w, address: showroom?.address ?? null }));
}

function isRetryable(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2034") return true; // serialization failure / deadlock
  if (e.code === "P2002") {
    // reference collision (astronomically rare) — a fresh reference on retry fixes it
    const target = ([] as string[]).concat((e.meta?.target as string[] | string | undefined) ?? []);
    return target.some((t) => t.includes("reference"));
  }
  return false;
}

const slotFull = () =>
  new ApiErr(409, "SLOT_TAKEN", "All service bays are booked for that slot. Please pick another.", {
    slotStart: "This slot is full",
  });

export async function bookService(input: ServiceBookingInput): Promise<ServiceBookingCreated> {
  const slotStart = new Date(input.slotStart);
  const workshop = await db.workshop.findUnique({
    where: { id: input.workshopId },
    select: { id: true, name: true, bays: true, openHour: true, closeHour: true, isActive: true },
  });
  if (!workshop || !workshop.isActive) {
    throw badRequest("Workshop not found", { workshopId: "Choose a workshop" });
  }
  if (
    !isValidServiceSlotStart({
      slotStart,
      openHour: workshop.openHour,
      closeHour: workshop.closeHour,
    })
  ) {
    throw new ApiErr(400, "SLOT_INVALID", "That time slot is not available. Please pick another slot.", {
      slotStart: "Pick a slot from the list",
    });
  }
  if (workshop.bays <= 0) throw slotFull();
  const slotEnd = new Date(slotStart.getTime() + SERVICE_SLOT_MINUTES * 60_000);

  const attempt = () =>
    db.$transaction(
      async (tx) => {
        const taken = await tx.serviceBooking.count({
          where: { workshopId: workshop.id, slotStart, status: "CONFIRMED" },
        });
        if (taken >= workshop.bays) throw slotFull();
        const reference = makeServiceReference();
        const booking = await tx.serviceBooking.create({
          data: {
            reference,
            workshopId: workshop.id,
            slotStart,
            slotEnd,
            name: input.name,
            phone: input.phone,
            email: input.email ?? null,
            registration: input.registration,
            modelName: input.modelName,
            serviceType: input.serviceType,
            odometerKm: input.odometerKm ?? null,
            notes: input.notes ?? null,
            consent: true,
            consentAt: new Date(),
          },
          select: { id: true, reference: true },
        });
        return {
          bookingId: booking.id,
          reference: booking.reference,
          slotStart: slotStart.toISOString(),
          slotEnd: slotEnd.toISOString(),
          workshopName: workshop.name,
          serviceType: input.serviceType,
        } satisfies ServiceBookingCreated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  // Several retries with jittered backoff: under a burst, each retry sees more committed bookings,
  // so free bays still get filled and a full slot is rejected cleanly.
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (e) {
      if (!isRetryable(e)) throw e;
      if (i >= MAX_BOOKING_RETRIES) {
        // Still contended: tell the buyer to pick again rather than a 500.
        throw new ApiErr(409, "SLOT_TAKEN", "That slot is in high demand right now. Please pick another.");
      }
      await new Promise((r) => setTimeout(r, 20 + randomInt(60) * (i + 1)));
    }
  }
}

/** ASSUMPTION: up to 6 retries on serialization conflicts before asking the buyer to pick again. */
const MAX_BOOKING_RETRIES = 6;

/** Public confirmation page data. No name/phone; registration masked. */
export async function getServiceBookingSummary(reference: string) {
  if (!SERVICE_REFERENCE_RE.test(reference)) return null;
  const b = await db.serviceBooking.findUnique({
    where: { reference },
    select: {
      reference: true,
      slotStart: true,
      slotEnd: true,
      status: true,
      serviceType: true,
      modelName: true,
      registration: true,
      workshop: { select: { name: true, showroom: { select: { address: true } } } },
    },
  });
  if (!b) return null;
  const { registration, workshop, ...rest } = b;
  return {
    ...rest,
    serviceType: rest.serviceType as ServiceType,
    registrationMasked: maskRegistration(registration),
    workshopName: workshop.name,
    workshopAddress: workshop.showroom?.address ?? null,
  };
}

/** ADMIN: bookings for one IST day (optionally one workshop / status) + per-slot utilisation. */
export async function listServiceBookings(q: ServiceBookingListQuery): Promise<ServiceBookingList> {
  const bounds = istDayBoundsUtc(q.date);
  if (!bounds) throw badRequest("Invalid date", { date: "Use YYYY-MM-DD" });

  const workshops = await db.workshop.findMany({
    where: q.workshopId ? { id: q.workshopId } : { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, bays: true, openHour: true, closeHour: true },
  });
  const ids = workshops.map((w) => w.id);
  const rows = await db.serviceBooking.findMany({
    where: { workshopId: { in: ids }, slotStart: { gte: bounds.start, lt: bounds.end } },
    orderBy: [{ slotStart: "asc" }, { createdAt: "asc" }],
    include: { workshop: { select: { name: true } } },
  });

  const utilisation = workshops.map((w) => {
    const counts = countByStart(
      rows.filter((r) => r.workshopId === w.id && r.status === "CONFIRMED").map((r) => r.slotStart),
    );
    return {
      id: w.id,
      name: w.name,
      bays: w.bays,
      slots: serviceSlotGrid({ date: q.date, openHour: w.openHour, closeHour: w.closeHour }).map((s) => ({
        start: s.start.toISOString(),
        label: s.label,
        booked: counts.get(s.start.getTime()) ?? 0,
        bays: w.bays,
      })),
    };
  });

  const bookings: AdminServiceBooking[] = rows
    .filter((r) => !q.status || r.status === q.status)
    .map((r) => ({
      id: r.id,
      reference: r.reference,
      workshopId: r.workshopId,
      workshopName: r.workshop.name,
      slotStart: r.slotStart.toISOString(),
      slotEnd: r.slotEnd.toISOString(),
      name: r.name,
      phone: r.phone,
      email: r.email,
      registration: r.registration,
      modelName: r.modelName,
      serviceType: r.serviceType,
      odometerKm: r.odometerKm,
      notes: r.notes,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));

  return { date: q.date, workshops: utilisation, bookings };
}

/** ADMIN: only CONFIRMED bookings can be cancelled or completed (freed bays are bookable again). */
export async function updateServiceBookingStatus(
  id: string,
  status: Extract<ServiceBookingStatus, "CANCELLED" | "COMPLETED">,
): Promise<{ id: string; reference: string; status: ServiceBookingStatus }> {
  const { count } = await db.serviceBooking.updateMany({
    where: { id, status: "CONFIRMED" },
    data: { status },
  });
  const row = await db.serviceBooking.findUnique({
    where: { id },
    select: { id: true, reference: true, status: true },
  });
  if (!row) throw notFound("Service booking not found");
  if (count === 0) {
    throw new ApiErr(409, "CONFLICT", `Booking ${row.reference} is already ${row.status.toLowerCase()}`);
  }
  return row;
}
