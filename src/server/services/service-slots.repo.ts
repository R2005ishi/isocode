/**
 * Real service-slot capacity for one workshop on one IST day. Server-only.
 */
import { db } from "@/lib/db";
import { generateServiceSlots, type ServiceSlot } from "./service-slots";
import { istDayBoundsUtc } from "./slots";

export async function getServiceSlots(workshopId: string, date: string): Promise<ServiceSlot[]> {
  const bounds = istDayBoundsUtc(date);
  if (!bounds) return [];

  const workshop = await db.workshop.findFirst({
    where: { id: workshopId, isActive: true },
    select: { bays: true, openHour: true, closeHour: true },
  });
  if (!workshop) return [];

  const bookings = await db.serviceBooking.findMany({
    where: {
      workshopId,
      status: "CONFIRMED",
      slotStart: { gte: bounds.start, lt: bounds.end },
    },
    select: { slotStart: true },
  });

  return generateServiceSlots({
    date,
    openHour: workshop.openHour,
    closeHour: workshop.closeHour,
    bays: workshop.bays,
    booked: bookings.map((b) => b.slotStart),
  });
}
