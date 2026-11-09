/**
 * Workshop service-slot maths and service-booking schemas. [client-safe]
 * Workshop hours and dates are IST (same fixed-offset helpers as test-drive slots); everything
 * stored/sent over the wire is a UTC instant. Capacity per slot = the workshop's number of bays.
 */
import { z } from "zod";
import {
  EmailSchema,
  IsoDateSchema,
  LocaleEnum,
  NameSchema,
  PhoneSchema,
  ConsentSchema,
} from "@/types/contracts";
import { BOOKING_WINDOW_DAYS, istDateString, istDayBoundsUtc, isValidSlotStart } from "./slots";

/** ASSUMPTION: a service slot is 60 minutes (one drop-off window per bay); last slot ends by closing. */
export const SERVICE_SLOT_MINUTES = 60;
/** ASSUMPTION: service bookings use the same window as test drives — today (future slots) + 14 days. */
export const SERVICE_BOOKING_WINDOW_DAYS = BOOKING_WINDOW_DAYS;

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;

export const SERVICE_TYPES = ["PERIODIC", "REPAIR", "ACCIDENT", "OTHER"] as const;
export const ServiceTypeEnum = z.enum(SERVICE_TYPES);
export type ServiceType = z.infer<typeof ServiceTypeEnum>;

export const SERVICE_BOOKING_STATUSES = ["CONFIRMED", "CANCELLED", "COMPLETED"] as const;
export const ServiceBookingStatusEnum = z.enum(SERVICE_BOOKING_STATUSES);
export type ServiceBookingStatusValue = z.infer<typeof ServiceBookingStatusEnum>;

export type ServiceSlot = {
  start: string; // ISO (UTC)
  end: string;
  label: string; // "09:00" in IST
  capacity: number; // bays
  booked: number; // CONFIRMED bookings starting at this instant
  remaining: number;
  available: boolean; // future and remaining > 0
};

/** Day grid of a workshop (every slot, past or not), for one IST date. [] for an invalid date. */
export function serviceSlotGrid(opts: {
  date: string;
  openHour: number;
  closeHour: number;
  slotMinutes?: number;
}): { start: Date; end: Date; label: string }[] {
  const bounds = istDayBoundsUtc(opts.date);
  const step = opts.slotMinutes ?? SERVICE_SLOT_MINUTES;
  if (!bounds || !(step > 0)) return [];
  const out: { start: Date; end: Date; label: string }[] = [];
  for (let min = opts.openHour * 60; min + step <= opts.closeHour * 60; min += step) {
    const start = bounds.start.getTime() + min * MIN_MS;
    out.push({
      start: new Date(start),
      end: new Date(start + step * MIN_MS),
      label: `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`,
    });
  }
  return out;
}

/** Number of bookings per slot start instant (ms). */
export function countByStart(booked: Date[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const b of booked) m.set(b.getTime(), (m.get(b.getTime()) ?? 0) + 1);
  return m;
}

function inServiceWindow(date: string, now: Date): boolean {
  const target = istDayBoundsUtc(date);
  const today = istDayBoundsUtc(istDateString(now));
  if (!target || !today) return false;
  const off = Math.round((target.start.getTime() - today.start.getTime()) / DAY_MS);
  return off >= 0 && off <= SERVICE_BOOKING_WINDOW_DAYS;
}

/**
 * Bookable service slots for one workshop on one IST day. Slots that have already started are
 * left out; a slot whose bays are all taken is returned with `available: false` so the buyer can
 * see it is full. Dates outside today..today+SERVICE_BOOKING_WINDOW_DAYS (IST) return [].
 * `booked` holds the start instant of every CONFIRMED booking that day (one entry per booking).
 */
export function generateServiceSlots(opts: {
  date: string;
  openHour: number;
  closeHour: number;
  bays: number;
  booked: Date[];
  slotMinutes?: number;
  now?: Date;
}): ServiceSlot[] {
  const now = opts.now ?? new Date();
  if (!inServiceWindow(opts.date, now)) return [];
  const capacity = Math.max(0, Math.floor(opts.bays));
  const counts = countByStart(opts.booked);
  return serviceSlotGrid(opts)
    .filter((s) => s.start.getTime() > now.getTime())
    .map((s) => {
      const booked = counts.get(s.start.getTime()) ?? 0;
      const remaining = Math.max(0, capacity - booked);
      return {
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        label: s.label,
        capacity,
        booked,
        remaining,
        available: remaining > 0,
      };
    });
}

/**
 * A requested service-slot start is valid when it is on the workshop's grid, ends by closing,
 * is in the future and inside the booking window. Capacity is checked separately (in a
 * serializable transaction) because it depends on concurrent bookings.
 */
export function isValidServiceSlotStart(opts: {
  slotStart: Date;
  openHour: number;
  closeHour: number;
  slotMinutes?: number;
  now?: Date;
}): boolean {
  return isValidSlotStart({ ...opts, slotMinutes: opts.slotMinutes ?? SERVICE_SLOT_MINUTES });
}

// ─── Schemas (shared by API routes and the booking form) ───────────────────

export const ServiceSlotQuerySchema = z.object({
  workshopId: z.string().min(1),
  date: IsoDateSchema,
});

/** Indian registration, spaces/hyphens removed, upper-cased (e.g. UP32AB1282, 22BH1234AA). */
export const RegistrationSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6,11}$/, "Enter the car's registration number"));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s ? s : undefined));

export const ServiceBookingCreateSchema = z.object({
  workshopId: z.string().min(1),
  slotStart: z.string().datetime(),
  name: NameSchema,
  phone: PhoneSchema,
  email: EmailSchema.optional().or(z.literal("").transform(() => undefined)),
  registration: RegistrationSchema,
  modelName: z.string().trim().min(1, "Enter your car's model").max(60),
  serviceType: ServiceTypeEnum,
  odometerKm: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/[,\s]/g, ""))),
    z
      .number({ invalid_type_error: "Enter kilometres as a number" })
      .int("Enter whole kilometres")
      .min(0)
      .max(1_000_000)
      .optional(),
  ),
  notes: optionalText(500),
  locale: LocaleEnum.default("en"),
  consent: ConsentSchema,
});
export type ServiceBookingCreate = z.input<typeof ServiceBookingCreateSchema>;
export type ServiceBookingInput = z.output<typeof ServiceBookingCreateSchema>;

export type ServiceBookingCreated = {
  bookingId: string;
  reference: string;
  slotStart: string;
  slotEnd: string;
  workshopName: string;
  serviceType: ServiceType;
};

export type PublicWorkshop = {
  id: string;
  name: string;
  slug: string;
  bays: number;
  openHour: number;
  closeHour: number;
  address: string | null;
};

export const ServiceBookingListQuerySchema = z.object({
  date: IsoDateSchema,
  workshopId: z.string().min(1).optional(),
  status: ServiceBookingStatusEnum.optional(),
});
export type ServiceBookingListQuery = z.output<typeof ServiceBookingListQuerySchema>;

export const ServiceBookingStatusPatchSchema = z.object({
  status: z.enum(["CANCELLED", "COMPLETED"]),
});

export type AdminServiceBooking = {
  id: string;
  reference: string;
  workshopId: string;
  workshopName: string;
  slotStart: string;
  slotEnd: string;
  name: string;
  phone: string;
  email: string | null;
  registration: string;
  modelName: string;
  serviceType: string;
  odometerKm: number | null;
  notes: string | null;
  status: ServiceBookingStatusValue;
  createdAt: string;
};

export type WorkshopUtilisation = {
  id: string;
  name: string;
  bays: number;
  slots: { start: string; label: string; booked: number; bays: number }[];
};

export type ServiceBookingList = {
  date: string;
  workshops: WorkshopUtilisation[];
  bookings: AdminServiceBooking[];
};
