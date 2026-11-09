import { describe, expect, it } from "vitest";
import { ESCALATE_DESK_MS, ESCALATE_REASSIGN_MS, minutesSince, nextEscalationLevel } from "./escalation";

const NOW = new Date("2026-11-09T06:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const lead = (over: Partial<Parameters<typeof nextEscalationLevel>[0]> = {}) => ({
  status: "NEW",
  createdAt: ago(0),
  firstContactAt: null,
  escalationLevel: 0,
  ...over,
});

describe("nextEscalationLevel", () => {
  it("does nothing inside the 5-minute window", () => {
    expect(nextEscalationLevel(lead({ createdAt: ago(ESCALATE_REASSIGN_MS - 1) }), NOW)).toBeNull();
  });

  it("reassigns exactly at 5 minutes", () => {
    expect(nextEscalationLevel(lead({ createdAt: ago(ESCALATE_REASSIGN_MS) }), NOW)).toBe(1);
  });

  it("waits until 10 minutes before the second desk alert", () => {
    const l = lead({ escalationLevel: 1, createdAt: ago(ESCALATE_DESK_MS - 1) });
    expect(nextEscalationLevel(l, NOW)).toBeNull();
    expect(nextEscalationLevel({ ...l, createdAt: ago(ESCALATE_DESK_MS) }, NOW)).toBe(2);
  });

  it("applies levels one at a time when a sweep was missed", () => {
    expect(nextEscalationLevel(lead({ createdAt: ago(30 * 60_000) }), NOW)).toBe(1);
  });

  it("stops once the lead has been contacted", () => {
    const l = lead({ createdAt: ago(20 * 60_000), firstContactAt: ago(60_000) });
    expect(nextEscalationLevel(l, NOW)).toBeNull();
  });

  it("stops once a consultant moves the lead out of NEW", () => {
    for (const status of ["CONTACTED", "TEST_DRIVE_BOOKED", "NEGOTIATION", "WON", "LOST"]) {
      expect(nextEscalationLevel(lead({ status, createdAt: ago(20 * 60_000) }), NOW)).toBeNull();
    }
  });

  it("never goes past level 2", () => {
    expect(nextEscalationLevel(lead({ escalationLevel: 2, createdAt: ago(3_600_000) }), NOW)).toBeNull();
  });
});

describe("minutesSince", () => {
  it("floors to whole minutes and never goes negative", () => {
    expect(minutesSince(ago(7 * 60_000 + 59_000), NOW)).toBe("7 min");
    expect(minutesSince(new Date(NOW.getTime() + 5000), NOW)).toBe("0 min");
  });
});
