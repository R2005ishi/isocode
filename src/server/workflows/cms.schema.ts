/**
 * Offers & banners (admin CMS) — zod schemas and pure helpers. [client-safe]
 * No db / server-only imports: the admin UI reuses these for status chips and validation.
 *
 * Pricing rule (DECISIONS): offers are text only. Nothing here touches prices.
 */
import { z } from "zod";

// ─── Field helpers ─────────────────────────────────────────────────────────
export const BANNER_PLACEMENTS = ["HOME"] as const;
export const BannerPlacementEnum = z.enum(BANNER_PLACEMENTS);
export type BannerPlacement = z.infer<typeof BannerPlacementEnum>;

/**
 * Internal, same-site path only: must start with a single "/", no protocol-relative "//" or "/\",
 * no backslashes, whitespace or control characters. (`javascript:` etc. can never start with "/".)
 */
export function isSafeInternalHref(href: string): boolean {
  if (!href.startsWith("/")) return false;
  if (href.startsWith("//") || href.startsWith("/\\")) return false;
  if (/[\s\\\u0000-\u001f\u007f]/.test(href)) return false;
  return true;
}

/**
 * Banner image: a file path under /public (e.g. `/cars/model-h.svg`). External URLs are not
 * accepted because the site CSP is `img-src 'self'` (see docs/ASSUMPTIONS.md).
 */
export function isSafeImagePath(src: string): boolean {
  return isSafeInternalHref(src) && !src.split(/[/?#]/).includes("..");
}

const trimmed = (max: number) => z.string().trim().max(max);
/** "" / null → null (clears the field); missing stays undefined so a PATCH leaves it untouched. */
function blankToNull<T>(v: T | "" | null | undefined): T | null | undefined {
  return v === undefined ? undefined : v === "" || v === null ? null : v;
}
/** Optional text: "" / null → null. */
const optText = (max: number) =>
  z
    .union([trimmed(max), z.null()])
    .optional()
    .transform(blankToNull);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** "YYYY-MM-DD" = calendar day in IST; anything else must be a full ISO timestamp. */
const DateInput = z
  .string()
  .trim()
  .refine((s) => (DATE_ONLY.test(s) ? !Number.isNaN(new Date(`${s}T00:00:00+05:30`).getTime()) : !Number.isNaN(Date.parse(s))), {
    message: "Enter a valid date",
  });

/** Start of an IST calendar day (or the exact timestamp given). */
export function toStartDate(s: string): Date {
  return DATE_ONLY.test(s) ? new Date(`${s}T00:00:00+05:30`) : new Date(s);
}
/** End of an IST calendar day — an offer "valid until 30 Nov" runs through that whole day. */
export function toEndDate(s: string): Date {
  return DATE_ONLY.test(s) ? new Date(`${s}T23:59:59.999+05:30`) : new Date(s);
}

const optDate = z
  .union([DateInput, z.literal(""), z.null()])
  .optional()
  .transform(blankToNull);

const InternalHref = z
  .string()
  .trim()
  .max(300)
  .refine(isSafeInternalHref, { message: "Use a site path starting with “/”, e.g. /cars/model-h" });
const ImagePath = z
  .string()
  .trim()
  .max(300)
  .refine(isSafeImagePath, { message: "Use an image path under /public, e.g. /cars/model-h.svg" });

// ─── Offers ────────────────────────────────────────────────────────────────
const OfferFields = z.object({
  title: trimmed(120).min(3, "At least 3 characters"),
  titleHi: optText(120),
  body: trimmed(600).min(3, "At least 3 characters"),
  bodyHi: optText(600),
  /** null / "" = applies to all models */
  modelId: z
    .union([z.string().trim().max(40), z.null()])
    .optional()
    .transform(blankToNull),
  validFrom: DateInput,
  validUntil: DateInput,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const AdminOfferSchema = OfferFields.superRefine((v, ctx) => {
  if (toEndDate(v.validUntil) < toStartDate(v.validFrom)) {
    ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Must be on or after the start date" });
  }
});
export const AdminOfferPatchSchema = z
  .object({
    title: OfferFields.shape.title,
    titleHi: optText(120),
    body: OfferFields.shape.body,
    bodyHi: optText(600),
    modelId: OfferFields.shape.modelId,
    validFrom: DateInput,
    validUntil: DateInput,
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999),
  })
  .partial();
export type AdminOfferInput = z.output<typeof AdminOfferSchema>;
export type AdminOfferPatch = z.output<typeof AdminOfferPatchSchema>;

// ─── Banners ───────────────────────────────────────────────────────────────
const BannerFields = z.object({
  title: trimmed(120).min(3, "At least 3 characters"),
  titleHi: optText(120),
  subtitle: optText(240),
  subtitleHi: optText(240),
  image: z
    .union([ImagePath, z.literal(""), z.null()])
    .optional()
    .transform(blankToNull),
  ctaLabel: optText(40),
  ctaLabelHi: optText(40),
  ctaHref: z
    .union([InternalHref, z.literal(""), z.null()])
    .optional()
    .transform(blankToNull),
  placement: BannerPlacementEnum.default("HOME"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  startsAt: optDate,
  endsAt: optDate,
});

/** Cross-field banner rules; returns field → message (empty when valid). Dates are Date or input strings. */
export function bannerIssues(v: {
  ctaLabel?: string | null;
  ctaHref?: string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (v.ctaLabel && !v.ctaHref) out.ctaHref = "Add a link for the button";
  if (v.ctaHref && !v.ctaLabel) out.ctaLabel = "Add a button label";
  if (v.startsAt && v.endsAt) {
    const s = typeof v.startsAt === "string" ? toStartDate(v.startsAt) : v.startsAt;
    const e = typeof v.endsAt === "string" ? toEndDate(v.endsAt) : v.endsAt;
    if (e < s) out.endsAt = "Must be on or after the start date";
  }
  return out;
}

export const AdminBannerSchema = BannerFields.superRefine((v, ctx) => {
  for (const [path, message] of Object.entries(bannerIssues(v))) ctx.addIssue({ code: "custom", path: [path], message });
});
export const AdminBannerPatchSchema = z
  .object({
    ...BannerFields.shape,
    placement: BannerPlacementEnum,
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999),
  })
  .partial();
export type AdminBannerInput = z.output<typeof AdminBannerSchema>;
export type AdminBannerPatch = z.output<typeof AdminBannerPatchSchema>;

// ─── "Is it live now?" ─────────────────────────────────────────────────────
export type CmsStatus = "LIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE";

type D = Date | string;
const ms = (d: D) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

export function offerStatus(o: { isActive: boolean; validFrom: D; validUntil: D }, now: Date = new Date()): CmsStatus {
  if (!o.isActive) return "INACTIVE";
  const t = now.getTime();
  if (t > ms(o.validUntil)) return "EXPIRED";
  if (t < ms(o.validFrom)) return "SCHEDULED";
  return "LIVE";
}

export function bannerStatus(
  b: { isActive: boolean; startsAt: D | null; endsAt: D | null },
  now: Date = new Date(),
): CmsStatus {
  if (!b.isActive) return "INACTIVE";
  const t = now.getTime();
  if (b.endsAt && t > ms(b.endsAt)) return "EXPIRED";
  if (b.startsAt && t < ms(b.startsAt)) return "SCHEDULED";
  return "LIVE";
}

/** Prisma `where` for offers shown to buyers now (model-specific + all-model offers). */
export function liveOfferWhere(now: Date, modelId?: string | null) {
  return {
    isActive: true,
    validFrom: { lte: now },
    validUntil: { gte: now },
    ...(modelId ? { OR: [{ modelId }, { modelId: null }] } : { modelId: null }),
  };
}

/** Prisma `where` for banners shown now; open-ended start/end dates are allowed. */
export function liveBannerWhere(placement: BannerPlacement, now: Date) {
  return {
    isActive: true,
    placement,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

/** Hindi text when the locale is hi and a translation exists, else English. */
export function pickLocale(locale: string, en: string, hi: string | null | undefined): string;
export function pickLocale(locale: string, en: string | null, hi: string | null | undefined): string | null;
export function pickLocale(locale: string, en: string | null, hi: string | null | undefined) {
  return locale === "hi" && hi && hi.trim() ? hi : en;
}

/** Date → "YYYY-MM-DD" (IST calendar day) for `<input type="date">`. */
export function toISTDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    d instanceof Date ? d : new Date(d),
  );
}
