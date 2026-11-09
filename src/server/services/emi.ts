/**
 * EMI calculator. [client-safe] — no server imports; used by the buyer-side calculator too.
 */
import type { EmiInput, EmiResult } from "@/types/contracts";

/** ASSUMPTION: defaults 9.5 % p.a., 60 months, 10 % down payment (all user-editable). */
export const EMI_DEFAULTS = { annualRatePct: 9.5, tenureMonths: 60, downPaymentPct: 10 } as const;

/**
 * Standard reducing-balance EMI: P·r·(1+r)^n / ((1+r)^n − 1), r = monthly rate.
 * The EMI is rounded to the rupee; totals are derived from the rounded EMI so the numbers the
 * buyer sees always add up.
 */
export function computeEmi(input: EmiInput): EmiResult {
  const { principal, annualRatePct, tenureMonths } = input;
  if (!Number.isFinite(principal) || principal < 0) {
    throw new RangeError("principal must be a non-negative number");
  }
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0 || annualRatePct > 30) {
    throw new RangeError("annualRatePct must be between 0 and 30");
  }
  if (!Number.isInteger(tenureMonths) || tenureMonths < 1 || tenureMonths > 120) {
    throw new RangeError("tenureMonths must be a whole number between 1 and 120");
  }

  const n = tenureMonths;
  const r = annualRatePct / 12 / 100;
  const raw = r === 0 ? principal / n : (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  const emi = Math.round(raw);
  const totalPayable = emi * n;
  return { emi, totalPayable, totalInterest: totalPayable - principal };
}
