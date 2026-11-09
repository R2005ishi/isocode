/**
 * On-road price breakup. [client-safe]
 * Inputs always come from the admin price table (PriceComponent) — never estimated, never AI.
 */
import type { OnRoadBreakup, PriceLine } from "@/types/contracts";

export const PRICE_DISCLAIMER =
  "Prices may change. Please confirm the final on-road price with the showroom before booking.";

export type PriceComponentInput = {
  roadTaxPct: number;
  registrationFee: number;
  insurance: number;
  accessoriesPack: number;
  otherCharges: number;
  validUntil: Date;
};

/** Thrown when there is no admin price row for a variant + city. API maps it to 404. */
export class PriceNotPublishedError extends Error {
  readonly code = "PRICE_NOT_PUBLISHED" as const;
  constructor(message = "Price not yet published for this city") {
    super(message);
    this.name = "PriceNotPublishedError";
  }
}

function assertAmount(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0) throw new RangeError(`${name} must be a non-negative number`);
}

function formatPct(pct: number): string {
  // 10 → "10", 8.5 → "8.5", 12.25 → "12.25"
  return String(Number(pct.toFixed(2)));
}

/**
 * Builds the line-by-line breakup. Every line is rounded to the rupee and the total is the sum
 * of the rounded lines, so the card always adds up exactly. "Other charges" is omitted when 0.
 */
export function computeOnRoad(
  exShowroom: number,
  c: PriceComponentInput,
  meta: { variantId: string; citySlug: string; cityName: string },
  now: Date = new Date(),
): OnRoadBreakup {
  assertAmount("exShowroom", exShowroom);
  assertAmount("roadTaxPct", c.roadTaxPct);
  assertAmount("registrationFee", c.registrationFee);
  assertAmount("insurance", c.insurance);
  assertAmount("accessoriesPack", c.accessoriesPack);
  assertAmount("otherCharges", c.otherCharges);
  if (!(c.validUntil instanceof Date) || Number.isNaN(c.validUntil.getTime())) {
    throw new RangeError("validUntil must be a valid date");
  }

  const lines: PriceLine[] = [
    { key: "exShowroom", label: "Ex-showroom price", amount: Math.round(exShowroom) },
    {
      key: "roadTax",
      label: "Road tax",
      amount: Math.round((exShowroom * c.roadTaxPct) / 100),
      note: `${formatPct(c.roadTaxPct)}% of ex-showroom`,
    },
    { key: "registration", label: "Registration", amount: Math.round(c.registrationFee) },
    { key: "insurance", label: "Insurance (1st year)", amount: Math.round(c.insurance) },
    { key: "accessories", label: "Accessories pack", amount: Math.round(c.accessoriesPack) },
  ];
  const other = Math.round(c.otherCharges);
  if (other > 0) lines.push({ key: "other", label: "Other charges", amount: other });

  return {
    variantId: meta.variantId,
    citySlug: meta.citySlug,
    cityName: meta.cityName,
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
    validUntil: c.validUntil.toISOString(),
    isExpired: now.getTime() > c.validUntil.getTime(),
    disclaimer: PRICE_DISCLAIMER,
  };
}
