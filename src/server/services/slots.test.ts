import { describe, expect, it } from "vitest";
import {
  BOOKING_WINDOW_DAYS,
  generateSlots,
  isValidSlotStart,
  istDateString,
  istDayBoundsUtc,
  SLOT_MINUTES,
} from "./slots";

const hours = { openHour: 10, closeHour: 19 };
// 2026-11-07 08:00 IST
const morning = new Date("2026-11-07T02:30:00.000Z");
/** UTC instant for an IST wall-clock time. */
const ist = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00.000+05:30`);

describe("generateSlots", () => {
  it("generates 45-minute slots from open; last slot (18:15) ends exactly at close", () => {
    const s = generateSlots({ date: "2026-11-08", ...hours, booked: [], now: morning });
    expect(SLOT_MINUTES).toBe(45);
    expect(s).toHaveLength(12);
    expect(s[0]).toEqual({
      start: "2026-11-08T04:30:00.000Z",
      end: "2026-11-08T05:15:00.000Z",
      label: "10:00",
      available: true,
    });
    expect(s.at(-1)!.label).toBe("18:15");
    expect(s.at(-1)!.end).toBe(ist("2026-11-08", "19:00").toISOString());
    expect(s.every((x) => x.available)).toBe(true);
  });

  it("allows a last slot that ends exactly at close", () => {
    const s = generateSlots({
      date: "2026-11-08",
      openHour: 10,
      closeHour: 13,
      slotMinutes: 60,
      booked: [],
      now: morning,
    });
    expect(s.map((x) => x.label)).toEqual(["10:00", "11:00", "12:00"]);
    expect(s.at(-1)!.end).toBe(ist("2026-11-08", "13:00").toISOString());
  });

  it("marks booked slots unavailable by start instant", () => {
    const s = generateSlots({
      date: "2026-11-08",
      ...hours,
      booked: [ist("2026-11-08", "10:45"), ist("2026-11-09", "10:45")],
      now: morning,
    });
    expect(s.filter((x) => !x.available).map((x) => x.label)).toEqual(["10:45"]);
  });

  it("marks past and just-started slots unavailable today", () => {
    const now = ist("2026-11-07", "12:15"); // exactly the 12:15 slot start
    const s = generateSlots({ date: "2026-11-07", ...hours, booked: [], now });
    const unavailable = s.filter((x) => !x.available).map((x) => x.label);
    expect(unavailable).toEqual(["10:00", "10:45", "11:30", "12:15"]);
    expect(s.find((x) => x.label === "13:00")!.available).toBe(true);
  });

  it("treats 18:40 UTC as the next IST day", () => {
    const now = new Date("2026-11-07T18:40:00.000Z"); // 00:10 IST on 8 Nov
    expect(istDateString(now)).toBe("2026-11-08");
    // 7 Nov is now yesterday in IST → outside window
    expect(generateSlots({ date: "2026-11-07", ...hours, booked: [], now })).toEqual([]);
    const today = generateSlots({ date: "2026-11-08", ...hours, booked: [], now });
    expect(today).toHaveLength(12);
    expect(today.every((x) => x.available)).toBe(true);
  });

  it("returns [] outside today..today+14 (IST) and for bad dates", () => {
    const base = { ...hours, booked: [], now: morning };
    expect(generateSlots({ date: "2026-11-06", ...base })).toEqual([]);
    expect(generateSlots({ date: "2026-11-21", ...base })).toHaveLength(12); // +14
    expect(generateSlots({ date: "2026-11-22", ...base })).toEqual([]); // +15
    expect(generateSlots({ date: "2026-02-30", ...base })).toEqual([]);
    expect(generateSlots({ date: "07-11-2026", ...base })).toEqual([]);
    expect(generateSlots({ date: "2026-11-08", ...base, slotMinutes: 0 })).toEqual([]);
    expect(BOOKING_WINDOW_DAYS).toBe(14);
  });

  it("defaults now to the current time", () => {
    expect(generateSlots({ date: "2000-01-01", ...hours, booked: [] })).toEqual([]);
    const todayIst = istDateString(new Date(Date.now() + 86_400_000));
    expect(generateSlots({ date: todayIst, ...hours, booked: [] }).length).toBe(12);
  });
});

describe("isValidSlotStart", () => {
  const ok = (slotStart: Date, extra: Partial<{ now: Date; slotMinutes: number }> = {}) =>
    isValidSlotStart({ slotStart, ...hours, now: morning, ...extra });

  it("accepts aligned future slots inside hours and window", () => {
    expect(ok(ist("2026-11-07", "10:00"))).toBe(true);
    expect(ok(ist("2026-11-08", "18:15"))).toBe(true);
    expect(ok(ist("2026-11-21", "14:30"))).toBe(true);
  });

  it("rejects misaligned starts", () => {
    expect(ok(ist("2026-11-08", "10:15"))).toBe(false);
    expect(ok(new Date(ist("2026-11-08", "10:45").getTime() + 1000))).toBe(false);
  });

  it("rejects starts outside hours or that would end after close", () => {
    expect(ok(ist("2026-11-08", "09:15"))).toBe(false);
    expect(ok(ist("2026-11-08", "19:00"))).toBe(false);
    expect(ok(ist("2026-11-08", "18:15"), { slotMinutes: 45 })).toBe(true);
    expect(ok(ist("2026-11-08", "18:30"), { slotMinutes: 30 })).toBe(true);
    expect(ok(ist("2026-11-08", "18:30"), { slotMinutes: 90 })).toBe(false);
    expect(ok(ist("2026-11-08", "19:30"))).toBe(false);
  });

  it("rejects past/now starts and those outside the window", () => {
    expect(ok(ist("2026-11-07", "10:00"), { now: ist("2026-11-07", "10:00") })).toBe(false);
    expect(ok(ist("2026-11-06", "10:00"))).toBe(false);
    expect(ok(ist("2026-11-22", "10:00"))).toBe(false);
    expect(ok(new Date("garbage"))).toBe(false);
    expect(ok(ist("2026-11-08", "10:00"), { slotMinutes: 0 })).toBe(false);
  });

  it("respects a custom slot length and default now", () => {
    expect(ok(ist("2026-11-08", "11:00"), { slotMinutes: 60 })).toBe(true);
    expect(ok(ist("2026-11-08", "10:45"), { slotMinutes: 60 })).toBe(false);
    expect(isValidSlotStart({ slotStart: ist("2000-01-01", "10:00"), ...hours })).toBe(false);
  });
});

describe("istDayBoundsUtc", () => {
  it("returns the UTC range for an IST day", () => {
    expect(istDayBoundsUtc("2026-11-08")).toEqual({
      start: new Date("2026-11-07T18:30:00.000Z"),
      end: new Date("2026-11-08T18:30:00.000Z"),
    });
    expect(istDayBoundsUtc("bad")).toBeNull();
  });
});
