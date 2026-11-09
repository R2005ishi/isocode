import { describe, expect, it } from "vitest";
import { computeEmi, EMI_DEFAULTS } from "./emi";

describe("computeEmi", () => {
  it("matches the standard formula for 10L at 9.5% over 60 months", () => {
    const r = computeEmi({ principal: 1_000_000, annualRatePct: 9.5, tenureMonths: 60 });
    expect(r.emi).toBe(21_002);
    expect(r.totalPayable).toBe(21_002 * 60);
    expect(r.totalInterest).toBe(21_002 * 60 - 1_000_000);
  });

  it("rounds EMI to the rupee", () => {
    const r = computeEmi({ principal: 100_000, annualRatePct: 12, tenureMonths: 12 });
    expect(r.emi).toBe(8885); // 8884.88
    expect(Number.isInteger(r.emi)).toBe(true);
  });

  it("handles 0% as simple division", () => {
    const r = computeEmi({ principal: 120_000, annualRatePct: 0, tenureMonths: 12 });
    expect(r).toEqual({ emi: 10_000, totalPayable: 120_000, totalInterest: 0 });
  });

  it("allows zero principal", () => {
    expect(computeEmi({ principal: 0, annualRatePct: 9.5, tenureMonths: 12 }).emi).toBe(0);
  });

  it("accepts the range edges", () => {
    expect(() => computeEmi({ principal: 1, annualRatePct: 30, tenureMonths: 120 })).not.toThrow();
    expect(() => computeEmi({ principal: 1, annualRatePct: 0, tenureMonths: 1 })).not.toThrow();
  });

  it.each([
    [{ principal: -1, annualRatePct: 9.5, tenureMonths: 60 }],
    [{ principal: Number.NaN, annualRatePct: 9.5, tenureMonths: 60 }],
    [{ principal: 1000, annualRatePct: -0.1, tenureMonths: 60 }],
    [{ principal: 1000, annualRatePct: 30.01, tenureMonths: 60 }],
    [{ principal: 1000, annualRatePct: Number.POSITIVE_INFINITY, tenureMonths: 60 }],
    [{ principal: 1000, annualRatePct: 9.5, tenureMonths: 0 }],
    [{ principal: 1000, annualRatePct: 9.5, tenureMonths: 121 }],
    [{ principal: 1000, annualRatePct: 9.5, tenureMonths: 12.5 }],
  ])("throws RangeError for %o", (input) => {
    expect(() => computeEmi(input)).toThrow(RangeError);
  });

  it("exposes the assumed defaults", () => {
    expect(EMI_DEFAULTS).toEqual({ annualRatePct: 9.5, tenureMonths: 60, downPaymentPct: 10 });
  });
});
