import { describe, expect, it } from "vitest";
import {
  generateServiceSlots,
  isValidServiceSlotStart,
  SERVICE_BOOKING_WINDOW_DAYS,
  SERVICE_SLOT_MINUTES,
  ServiceBookingCreateSchema,
  serviceSlotGrid,
} from "./service-slots";

const hours = { openHour: 9, closeHour: 18 };
/** UTC instant for an IST wall-clock time. */
const ist = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00.000+05:30`);
// 2026-11-07 08:00 IST
const morning = ist("2026-11-07", "08:00");

describe("generateServiceSlots", () => {
  it("generates 60-minute slots 09:00–17:00 with full capacity", () => {
    const s = generateServiceSlots({ date: "2026-11-08", ...hours, bays: 4, booked: [], now: morning });
    expect(SERVICE_SLOT_MINUTES).toBe(60);
    expect(s).toHaveLength(9);
    expect(s[0]).toEqual({
      start: ist("2026-11-08", "09:00").toISOString(),
      end: ist("2026-11-08", "10:00").toISOString(),
      label: "09:00",
      capacity: 4,
      booked: 0,
      remaining: 4,
      available: true,
    });
    expect(s.at(-1)!.label).toBe("17:00");
    expect(s.at(-1)!.end).toBe(ist("2026-11-08", "18:00").toISOString());
  });

  it("counts bookings per slot and marks full slots unavailable", () => {
    const ten = ist("2026-11-08", "10:00");
    const eleven = ist("2026-11-08", "11:00");
    const s = generateServiceSlots({
      date: "2026-11-08",
      ...hours,
      bays: 2,
      booked: [ten, eleven, new Date(eleven)],
      now: morning,
    });
    const byLabel = Object.fromEntries(s.map((x) => [x.label, x]));
    expect(byLabel["10:00"]).toMatchObject({ booked: 1, remaining: 1, available: true });
    expect(byLabel["11:00"]).toMatchObject({ booked: 2, remaining: 0, available: false });
    expect(byLabel["12:00"]).toMatchObject({ booked: 0, remaining: 2, available: true });
  });

  it("never reports negative remaining when over-booked", () => {
    const ten = ist("2026-11-08", "10:00");
    const s = generateServiceSlots({ date: "2026-11-08", ...hours, bays: 1, booked: [ten, ten], now: morning });
    expect(s.find((x) => x.label === "10:00")).toMatchObject({ booked: 2, remaining: 0, available: false });
  });

  it("a workshop with zero bays has nothing bookable", () => {
    const s = generateServiceSlots({ date: "2026-11-08", ...hours, bays: 0, booked: [], now: morning });
    expect(s.every((x) => !x.available)).toBe(true);
  });

  it("excludes slots that have already started today", () => {
    const now = ist("2026-11-07", "12:00"); // exactly the 12:00 slot start
    const s = generateServiceSlots({ date: "2026-11-07", ...hours, bays: 3, booked: [], now });
    expect(s.map((x) => x.label)).toEqual(["13:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("returns [] for past dates, dates beyond the window and invalid dates", () => {
    const base = { ...hours, bays: 3, booked: [], now: morning };
    expect(generateServiceSlots({ date: "2026-11-06", ...base })).toEqual([]);
    expect(generateServiceSlots({ date: "2026-11-22", ...base })).toEqual([]); // 15 days ahead
    expect(generateServiceSlots({ date: "2026-11-21", ...base })).toHaveLength(9); // 14 days ahead
    expect(generateServiceSlots({ date: "2026-02-30", ...base })).toEqual([]);
    expect(generateServiceSlots({ date: "nope", ...base })).toEqual([]);
    expect(SERVICE_BOOKING_WINDOW_DAYS).toBe(14);
  });

  it("uses the IST date, not the UTC date, near midnight", () => {
    // 2026-11-07 23:30 UTC = 2026-11-08 05:00 IST → "today" is the 8th in IST.
    const now = new Date("2026-11-07T23:30:00.000Z");
    expect(generateServiceSlots({ date: "2026-11-08", ...hours, bays: 1, booked: [], now })).toHaveLength(9);
    expect(generateServiceSlots({ date: "2026-11-07", ...hours, bays: 1, booked: [], now })).toEqual([]);
  });
});

describe("serviceSlotGrid", () => {
  it("includes past slots (used for admin utilisation)", () => {
    expect(serviceSlotGrid({ date: "2020-01-01", ...hours })).toHaveLength(9);
    expect(serviceSlotGrid({ date: "bad", ...hours })).toEqual([]);
  });
});

describe("isValidServiceSlotStart", () => {
  const ok = (slotStart: Date, now = morning) => isValidServiceSlotStart({ slotStart, ...hours, now });

  it("accepts on-grid future slots within hours and window", () => {
    expect(ok(ist("2026-11-08", "09:00"))).toBe(true);
    expect(ok(ist("2026-11-08", "17:00"))).toBe(true);
    expect(ok(ist("2026-11-21", "12:00"))).toBe(true);
  });

  it("rejects misaligned, out-of-hours, past and out-of-window starts", () => {
    expect(ok(ist("2026-11-08", "09:30"))).toBe(false);
    expect(ok(ist("2026-11-08", "18:00"))).toBe(false);
    expect(ok(ist("2026-11-08", "08:00"))).toBe(false);
    expect(ok(ist("2026-11-07", "09:00"), ist("2026-11-07", "09:00"))).toBe(false);
    expect(ok(ist("2026-11-22", "09:00"))).toBe(false);
    expect(ok(new Date("invalid"))).toBe(false);
  });
});

describe("ServiceBookingCreateSchema", () => {
  const valid = {
    workshopId: "w1",
    slotStart: ist("2026-11-08", "10:00").toISOString(),
    name: "Asha Verma",
    phone: "+91 98000 00001",
    email: "",
    registration: "up-32 ab 1282",
    modelName: "Model H",
    serviceType: "PERIODIC",
    odometerKm: "12,500",
    notes: "",
    consent: true,
  };

  it("normalises phone, registration, odometer and blanks", () => {
    const out = ServiceBookingCreateSchema.parse(valid);
    expect(out).toMatchObject({
      phone: "9800000001",
      registration: "UP32AB1282",
      odometerKm: 12500,
      email: undefined,
      notes: undefined,
      locale: "en",
    });
  });

  it("odometer is optional", () => {
    expect(ServiceBookingCreateSchema.parse({ ...valid, odometerKm: "" }).odometerKm).toBeUndefined();
  });

  it("rejects bad service type, registration, odometer and missing consent", () => {
    expect(ServiceBookingCreateSchema.safeParse({ ...valid, serviceType: "WASH" }).success).toBe(false);
    expect(ServiceBookingCreateSchema.safeParse({ ...valid, registration: "AB" }).success).toBe(false);
    expect(ServiceBookingCreateSchema.safeParse({ ...valid, odometerKm: "lots" }).success).toBe(false);
    expect(ServiceBookingCreateSchema.safeParse({ ...valid, odometerKm: -5 }).success).toBe(false);
    expect(ServiceBookingCreateSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });
});
