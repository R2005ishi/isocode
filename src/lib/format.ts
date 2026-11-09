/**
 * Display formatting shared by buyer and staff screens. Client-safe (no server imports).
 * Money is whole rupees; dates are shown in IST regardless of the viewer's device zone.
 */

export const IST = "Asia/Kolkata";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inNum = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** `1245000` → `₹12,45,000` (Indian digit grouping, no paise). */
export function formatINR(n: number): string {
  return inr.format(Math.round(n));
}

/** `125000` → `1,25,000` (Indian grouping, no currency). */
export function formatNumberIN(n: number): string {
  return inNum.format(Math.round(n));
}

/** `1245000` → `₹12.45 lakh`; `12500000` → `₹1.25 crore`. Compact, for cards. */
export function formatLakh(n: number, locale: "en" | "hi" = "en"): string {
  const lakhWord = locale === "hi" ? "लाख" : "lakh";
  const croreWord = locale === "hi" ? "करोड़" : "crore";
  if (n >= 1_00_00_000) return `₹${trim(n / 1_00_00_000)} ${croreWord}`;
  if (n >= 1_00_000) return `₹${trim(n / 1_00_000)} ${lakhWord}`;
  return formatINR(n);
}

function trim(x: number) {
  return x.toFixed(2).replace(/\.?0+$/, "");
}

function toDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

function intlLocale(locale?: string) {
  return locale === "hi" ? "hi-IN" : "en-IN";
}

/** `7 Nov 2026` in IST (or the Hindi equivalent). */
export function formatDateIST(
  d: Date | string,
  locale?: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: IST, ...opts }).format(toDate(d));
}

/** `10:45 am` in IST. */
export function formatTimeIST(d: Date | string, locale?: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(d));
}

/** `Sat, 7 Nov 2026, 10:45 am` in IST. */
export function formatDateTimeIST(d: Date | string, locale?: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(d));
}

/** Today's date in IST as `YYYY-MM-DD`, optionally offset by whole days. */
export function isoDateIST(offsetDays = 0, now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(shifted);
}
