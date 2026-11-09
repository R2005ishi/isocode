import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { pastSale: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import { computePriceBand, priceBandFor } from "./price-band";

describe("computePriceBand", () => {
  it("returns median and Q1/Q3 rounded to ₹1,000", () => {
    // sorted: 500000 520000 541000 560000 600000 → Q1 520000, median 541000, Q3 560000
    expect(computePriceBand([600_000, 520_000, 541_000, 500_000, 560_000])).toEqual({
      ok: true,
      low: 520_000,
      median: 541_000,
      high: 560_000,
      comparables: 5,
    });
  });

  it("interpolates and rounds", () => {
    // sorted 501200 512900 530400 548700 → Q1 509975, median 521650, Q3 534975
    expect(computePriceBand([548_700, 501_200, 530_400, 512_900])).toEqual({
      ok: true,
      low: 510_000,
      median: 522_000,
      high: 535_000,
      comparables: 4,
    });
  });

  it("refuses with fewer than 3 comparables", () => {
    expect(computePriceBand([500_000, 520_000])).toEqual({
      ok: false,
      reason: "NOT_ENOUGH_COMPARABLES",
      comparables: 2,
    });
    expect(computePriceBand([])).toMatchObject({ ok: false, comparables: 0 });
  });
});

describe("priceBandFor", () => {
  beforeEach(() => findMany.mockReset());

  it("queries same model, year ±1, km ±25,000", async () => {
    findMany.mockResolvedValue([{ price: 700_000 }, { price: 720_000 }, { price: 740_000 }]);
    const res = await priceBandFor("Model C", 2022, 30_000);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        modelName: { equals: "Model C", mode: "insensitive" },
        year: { gte: 2021, lte: 2023 },
        km: { gte: 5_000, lte: 55_000 },
      },
      select: { price: true },
    });
    expect(res).toEqual({ ok: true, low: 710_000, median: 720_000, high: 730_000, comparables: 3 });
  });
});
