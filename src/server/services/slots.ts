/**
 * Test-drive slot maths. [client-safe]
 * Showroom hours and dates are IST (Asia/Kolkata, UTC+05:30, no DST), so a fixed offset is exact.
 * Everything stored/sent over the wire is a UTC instant.
 */
import type { Slot } from "@/types/contracts";

/** ASSUMPTION: test-drive slot length is 45 minutes; last slot must end by closing time. */
export const SLOT_MINUTES = 45;
/** ASSUMPTION: bookings open for today (future slots only) and the next 14 days. */
export const BOOKING_WINDOW_DAYS = 14;

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

/** IST calendar date ("YYYY-MM-DD") of an instant. */
export function istDateString(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of 00:00 IST on the given date, or null if the string isn't a real date. */
function istMidnightUtc(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null; // e.g. 2026-02-30
  }
  return utc - IST_OFFSET_MS;
}

/** UTC bounds [start, end) of an IST calendar day; null for an invalid date string. */
export function istDayBoundsUtc(date: string): { start: Date; end: Date } | null {
  const start = istMidnightUtc(date);
  return start === null ? null : { start: new Date(start), end: new Date(start + DAY_MS) };
}

/** Days between today (IST) and `date`; null if invalid. */
function dayOffsetFromToday(date: string, now: Date): number | null {
  const target = istMidnightUtc(date);
  const today = istMidnightUtc(istDateString(now));
  if (target === null || today === null) return null;
  return Math.round((target - today) / DAY_MS);
}

function inWindow(date: string, now: Date): boolean {
  const off = dayOffsetFromToday(date, now);
  return off !== null && off >= 0 && off <= BOOKING_WINDOW_DAYS;
}

function labelFor(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * All slots for one IST day, each flagged available/unavailable. A slot is unavailable when it is
 * already booked (matched by start instant) or when it has already started. Dates outside
 * today..today+BOOKING_WINDOW_DAYS (IST) return [].
 */
export function generateSlots(opts: {
  date: string;
  openHour: number;
  closeHour: number;
  slotMinutes?: number;
  booked: Date[];
  now?: Date;
}): Slot[] {
  const now = opts.now ?? new Date();
  const step = opts.slotMinutes ?? SLOT_MINUTES;
  if (!(step > 0) || !inWindow(opts.date, now)) return [];
  const dayStart = istMidnightUtc(opts.date)!;

  const bookedSet = new Set(opts.booked.map((b) => b.getTime()));
  const slots: Slot[] = [];
  const closeMin = opts.closeHour * 60;
  for (let min = opts.openHour * 60; min + step <= closeMin; min += step) {
    const start = dayStart + min * MIN_MS;
    const end = start + step * MIN_MS;
    slots.push({
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      label: labelFor(min),
      available: start > now.getTime() && !bookedSet.has(start),
    });
  }
  return slots;
}

/**
 * Server-side check for a requested slot start: aligned to the slot grid from opening time,
 * within hours (ends by close), in the future, and inside the booking window.
 * Does NOT check whether it is already booked — the DB unique constraint does that.
 */
export function isValidSlotStart(opts: {
  slotStart: Date;
  openHour: number;
  closeHour: number;
  slotMinutes?: number;
  now?: Date;
}): boolean {
  const now = opts.now ?? new Date();
  const step = opts.slotMinutes ?? SLOT_MINUTES;
  const t = opts.slotStart.getTime();
  if (!Number.isFinite(t) || !(step > 0)) return false;
  if (t <= now.getTime()) return false;

  const date = istDateString(opts.slotStart);
  if (!inWindow(date, now)) return false;

  const sinceMidnightMs = t - istMidnightUtc(date)!;
  if (sinceMidnightMs % MIN_MS !== 0) return false;
  const min = sinceMidnightMs / MIN_MS;
  const openMin = opts.openHour * 60;
  if (min < openMin || min + step > opts.closeHour * 60) return false;
  return (min - openMin) % step === 0;
}
