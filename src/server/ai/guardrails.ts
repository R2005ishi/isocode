/**
 * Output guardrails for AI reply drafts. Pure functions — no I/O.
 *
 * The brief says drafts must never quote discounts and prices only ever come from the admin
 * price table. The prompt asks for that, but prompts are requests, not guarantees, so every
 * draft is checked here in code before a consultant ever sees it.
 */

// English patterns use \b; JS \b does not understand Devanagari, so Hindi terms match as plain substrings.
const DISCOUNT_PATTERNS: RegExp[] = [
  /\bdiscount(?:s|ed)?\b/giu,
  /%\s*off\b/giu,
  /(?:₹|\brs\.?|\binr)\s*\d[\d,]*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|लाख)?\s*off\b/giu,
  /\bcash\s*-?\s*back\b/giu,
  /\boffers?\b/giu,
  /\bfree\s+accessor(?:y|ies)\b/giu,
  /\bspecial\s+price\b/giu,
  /\bbest\s+price\b/giu,
  /\bdeals?\b/giu,
  /\bnegotia(?:ble|te|tion)\b/giu,
  /छूट/gu,
  /ऑफ़?र/gu,
  /डिस्काउंट/gu,
  /कैशबैक/gu,
];

/** Returns every discount/offer phrase found (empty array = clean). */
export function findDiscountLanguage(text: string): string[] {
  const hits: string[] = [];
  for (const re of DISCOUNT_PATTERNS) {
    for (const m of text.matchAll(re)) hits.push(m[0]);
  }
  return hits;
}

const DEVANAGARI_DIGITS = "०१२३४५६७८९";
function normaliseDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const UNIT = String.raw`(lakhs?|lacs?|लाख|crores?|cr(?![a-z])|करोड़|करोड)`;

/** Ordered: first match wins for any span of text, so "₹12.45 lakh" is one amount, not two. */
const AMOUNT_PATTERNS: RegExp[] = [
  // ₹12,45,000 · Rs. 1245000 · INR 12.45 lakh
  new RegExp(String.raw`(?:₹|\bRs\.?|\bINR)\s*${NUM}(?:\s*${UNIT})?`, "giu"),
  // 12.45 lakh · 12 लाख (no currency sign)
  new RegExp(String.raw`${NUM}\s*${UNIT}`, "giu"),
  // 1245000 rupees · 1245000 रुपये
  new RegExp(String.raw`${NUM}\s*(?:rupees?|रुपये|रुपए|रुपया)`, "giu"),
];

export type RupeeMention = {
  raw: string;
  /** Normalised whole-rupee value. */
  value: number;
  /** Rounding tolerance implied by how it was written (e.g. "12.45 lakh" is precise to ₹1,000). */
  precision: number;
};

function unitMultiplier(unit: string | undefined): number {
  if (!unit) return 1;
  const u = unit.toLowerCase();
  if (u.startsWith("lakh") || u.startsWith("lac") || u === "लाख") return 100_000;
  return 10_000_000; // crore / cr / करोड़
}

/** Extract every rupee amount in the text, normalised to whole rupees. */
export function extractRupeeAmounts(input: string): RupeeMention[] {
  const text = normaliseDigits(input);
  const taken: [number, number][] = [];
  const found: (RupeeMention & { at: number })[] = [];
  for (const re of AMOUNT_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      const numStr = m[1].replace(/,/g, "");
      const mult = unitMultiplier(m[2]);
      const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
      found.push({
        at: start,
        raw: m[0].trim(),
        value: Math.round(Number(numStr) * mult),
        precision: Math.max(1, mult / 10 ** decimals),
      });
    }
  }
  return found
    .sort((a, b) => a.at - b.at)
    .map((m) => ({ raw: m.raw, value: m.value, precision: m.precision }));
}

/**
 * Every rupee amount in `text` that is not one of the `allowed` figures (breakup lines + total).
 * Lakh/crore figures are accepted when they are an allowed amount rounded to the precision shown
 * ("₹12.45 lakh" matches ₹12,45,000 and ₹12,45,400; it does not match ₹12,60,000).
 */
export function findUnverifiedRupees(text: string, allowed: number[]): string[] {
  return extractRupeeAmounts(text)
    .filter(
      (m) =>
        !allowed.some((a) =>
          m.precision === 1 ? a === m.value : Math.round(a / m.precision) * m.precision === m.value,
        ),
    )
    .map((m) => m.raw);
}
