import { describe, expect, it } from "vitest";
import {
  computeOnRoad,
  PRICE_DISCLAIMER,
  PriceNotPublishedError,
  type PriceComponentInput,
} from "./pricing";

const meta = { variantId: "v1", citySlug: "lucknow", cityName: "Lucknow" };
const now = new Date("2026-11-07T06:00:00.000Z");
const base: PriceComponentInput = {
  roadTaxPct: 10,
  registrationFee: 2100,
  insurance: 39_840,
  accessoriesPack: 15_000,
  otherCharges: 0,
  validUntil: new Date("2026-12-07T00:00:00.000Z"),
};

describe("computeOnRoad", () => {
  it("builds lines in order and omits other charges when 0", () => {
    const r = computeOnRoad(1_245_000, base, meta, now);
    expect(r.lines.map((l) => l.key)).toEqual([
      "exShowroom",
      "roadTax",
      "registration",
      "insurance",
      "accessories",
    ]);
    expect(r.lines[1]).toMatchObject({ amount: 124_500, note: "10% of ex-showroom" });
    expect(r.total).toBe(1_245_000 + 124_500 + 2100 + 39_840 + 15_000);
    expect(r).toMatchObject({ ...meta, isExpired: false, disclaimer: PRICE_DISCLAIMER });
    expect(r.validUntil).toBe("2026-12-07T00:00:00.000Z");
  });

  it("includes other charges as the last line when > 0", () => {
    const r = computeOnRoad(800_000, { ...base, otherCharges: 1500 }, meta, now);
    expect(r.lines.at(-1)).toMatchObject({ key: "other", amount: 1500 });
    expect(r.lines).toHaveLength(6);
  });

  it("rounds each line and totals the rounded lines", () => {
    // 999,999 × 8.5% = 84,999.915 → 85,000
    const r = computeOnRoad(
      999_999.4,
      { ...base, roadTaxPct: 8.5, insurance: 31_999.5, otherCharges: 0.4 },
      meta,
      now,
    );
    expect(r.lines[0]!.amount).toBe(999_999);
    expect(r.lines[1]).toMatchObject({ amount: 85_000, note: "8.5% of ex-showroom" });
    expect(r.lines[3]!.amount).toBe(32_000);
    expect(r.lines.some((l) => l.key === "other")).toBe(false); // 0.4 rounds to 0
    expect(r.total).toBe(r.lines.reduce((s, l) => s + l.amount, 0));
  });

  it("flags expiry only when now is after validUntil", () => {
    const vu = base.validUntil;
    expect(computeOnRoad(500_000, base, meta, vu).isExpired).toBe(false);
    expect(computeOnRoad(500_000, base, meta, new Date(vu.getTime() + 1)).isExpired).toBe(true);
  });

  it("defaults now to the current time", () => {
    const r = computeOnRoad(500_000, { ...base, validUntil: new Date(Date.now() - 1000) }, meta);
    expect(r.isExpired).toBe(true);
  });

  it.each([
    ["exShowroom", () => computeOnRoad(-1, base, meta, now)],
    ["roadTaxPct", () => computeOnRoad(1, { ...base, roadTaxPct: -1 }, meta, now)],
    ["registrationFee", () => computeOnRoad(1, { ...base, registrationFee: -1 }, meta, now)],
    ["insurance", () => computeOnRoad(1, { ...base, insurance: Number.NaN }, meta, now)],
    ["accessoriesPack", () => computeOnRoad(1, { ...base, accessoriesPack: -5 }, meta, now)],
    ["otherCharges", () => computeOnRoad(1, { ...base, otherCharges: -5 }, meta, now)],
    [
      "missing validUntil",
      () => computeOnRoad(1, { ...base, validUntil: undefined as unknown as Date }, meta, now),
    ],
    [
      "invalid validUntil",
      () => computeOnRoad(1, { ...base, validUntil: new Date("nope") }, meta, now),
    ],
  ])("throws RangeError for invalid %s", (_name, fn) => {
    expect(fn).toThrow(RangeError);
  });
});

describe("PriceNotPublishedError", () => {
  it("carries the API error code", () => {
    const e = new PriceNotPublishedError();
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("PRICE_NOT_PUBLISHED");
    expect(e.name).toBe("PriceNotPublishedError");
    expect(e.message).toMatch(/not yet published/);
  });
});
