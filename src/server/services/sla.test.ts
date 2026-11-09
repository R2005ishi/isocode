import { describe, expect, it } from "vitest";
import { SLA_AMBER_MS, SLA_MS, slaRemainingMs, slaState } from "./sla";

const created = new Date("2026-11-07T10:00:00.000Z");
const at = (ms: number) => new Date(created.getTime() + ms);

describe("slaState (not contacted)", () => {
  it("is GREEN just after creation and just under 3 minutes", () => {
    expect(slaState(created, null, at(0))).toBe("GREEN");
    expect(slaState(created, null, at(SLA_AMBER_MS - 1))).toBe("GREEN");
  });
  it("turns AMBER exactly at 3:00", () => {
    expect(slaState(created, null, at(3 * 60_000))).toBe("AMBER");
    expect(slaState(created, null, at(SLA_MS - 1))).toBe("AMBER");
  });
  it("turns RED exactly at 5:00", () => {
    expect(slaState(created, null, at(5 * 60_000))).toBe("RED");
    expect(slaState(created, null, at(60 * 60_000))).toBe("RED");
  });
  it("accepts ISO strings", () => {
    expect(slaState(created.toISOString(), null, at(4 * 60_000))).toBe("AMBER");
  });
  it("defaults now to the current time", () => {
    expect(slaState(new Date(), null)).toBe("GREEN");
  });
});

describe("slaState (contacted)", () => {
  it("is MET when contacted at exactly 5:00", () => {
    expect(slaState(created, at(SLA_MS), at(SLA_MS * 10))).toBe("MET");
    expect(slaState(created, at(30_000).toISOString())).toBe("MET");
  });
  it("is BREACHED when contacted after 5:00", () => {
    expect(slaState(created, at(SLA_MS + 1))).toBe("BREACHED");
  });
});

describe("slaRemainingMs", () => {
  it("counts down and goes negative when overdue", () => {
    expect(slaRemainingMs(created, at(0))).toBe(SLA_MS);
    expect(slaRemainingMs(created, at(SLA_MS))).toBe(0);
    expect(slaRemainingMs(created.toISOString(), at(SLA_MS + 1000))).toBe(-1000);
    expect(slaRemainingMs(new Date())).toBeGreaterThan(0);
  });
});
