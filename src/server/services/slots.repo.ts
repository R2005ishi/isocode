/**
 * Real free slots for one demo car on one IST day. Server-only.
 */
import { db } from "@/lib/db";
import type { Slot } from "@/types/contracts";
import { generateSlots, istDayBoundsUtc } from "./slots";

export async function getSlots(
  showroomId: string,
  demoCarId: string,
  date: string,
): Promise<Slot[]> {
  const bounds = istDayBoundsUtc(date);
  if (!bounds) return [];

  const [showroom, demoCar] = await Promise.all([
    db.showroom.findUnique({
      where: { id: showroomId },
      select: { openHour: true, closeHour: true },
    }),
    // The demo car must belong to this showroom and be active.
    db.demoCar.findFirst({
      where: { id: demoCarId, showroomId, isActive: true },
      select: { id: true },
    }),
  ]);
  if (!showroom || !demoCar) return [];

  const bookings = await db.testDriveBooking.findMany({
    where: {
      demoCarId,
      status: "CONFIRMED",
      slotStart: { gte: bounds.start, lt: bounds.end },
    },
    select: { slotStart: true },
  });

  return generateSlots({
    date,
    openHour: showroom.openHour,
    closeHour: showroom.closeHour,
    booked: bookings.map((b) => b.slotStart),
  });
}
