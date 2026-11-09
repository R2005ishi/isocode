/**
 * Used-car price band for the used-car manager.
 *
 * Deliberately NOT an LLM call: a price suggestion has to be explainable and reproducible
 * ("median of 7 comparable sales, middle half between X and Y"). Simple statistics over our own
 * past sales are more defensible than a language model guessing a number.
 */
import { db } from "@/lib/db";
import type { PriceBandResult } from "@/types/contracts";

// ASSUMPTION: comparables = same model name, model year ±1, odometer within ±25,000 km; need ≥ 3.
export const YEAR_WINDOW = 1;
export const KM_WINDOW = 25_000;
export const MIN_COMPARABLES = 3;

const round1000 = (n: number) => Math.round(n / 1000) * 1000;

/** Linear-interpolated quantile (same method as Excel QUARTILE.INC / numpy default). */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Pure: band from a list of comparable sale prices. low/high are Q1/Q3 (the middle half of sales). */
export function computePriceBand(prices: number[]): PriceBandResult {
  if (prices.length < MIN_COMPARABLES) {
    return { ok: false, reason: "NOT_ENOUGH_COMPARABLES", comparables: prices.length };
  }
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    ok: true,
    low: round1000(quantile(sorted, 0.25)),
    median: round1000(quantile(sorted, 0.5)),
    high: round1000(quantile(sorted, 0.75)),
    comparables: sorted.length,
  };
}

export async function priceBandFor(
  modelName: string,
  year: number,
  km: number,
): Promise<PriceBandResult> {
  const sales = await db.pastSale.findMany({
    where: {
      modelName: { equals: modelName, mode: "insensitive" },
      year: { gte: year - YEAR_WINDOW, lte: year + YEAR_WINDOW },
      km: { gte: Math.max(0, km - KM_WINDOW), lte: km + KM_WINDOW },
    },
    select: { price: true },
  });
  return computePriceBand(sales.map((s) => s.price));
}
