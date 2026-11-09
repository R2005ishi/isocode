/**
 * Trade-in request validation. Client-safe (no db / server-only imports): the buyer form and the
 * API route parse with the same schema. Messages are English (API contract); the form translates
 * them by field name.
 */
import { z } from "zod";
import {
  ConsentSchema,
  EmailSchema,
  LocaleEnum,
  NameSchema,
  PhoneSchema,
} from "@/types/contracts";

// ASSUMPTION: trade-in sanity limits (see docs/ASSUMPTIONS.md, "Trade-in").
export const TRADE_IN_MIN_YEAR = 1990;
export const TRADE_IN_MAX_KM = 10_00_000; // 10 lakh km
export const TRADE_IN_MAX_OWNERS = 9;
export const TRADE_IN_MIN_PRICE = 10_000; // ₹10,000
export const TRADE_IN_MAX_PRICE = 1_00_00_000; // ₹1 crore

export const TRADE_IN_FUELS = ["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"] as const;
export const TRADE_IN_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_WORK"] as const;
export type TradeInCondition = (typeof TRADE_IN_CONDITIONS)[number];

/** Current calendar year in IST (a car registered "this year" is allowed). */
export function currentYearIST(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }).format(now));
}

/** Form inputs arrive as strings ("1,25,000", "") or NaN from `valueAsNumber`; normalise. */
function toNumberOrUndefined(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isNaN(v) ? undefined : v;
  if (typeof v === "string") {
    const s = v.replace(/[,\s₹]/g, "");
    if (s === "") return undefined;
    const n = Number(s);
    return Number.isNaN(n) ? v : n;
  }
  return v;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s ? s : undefined));

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((s) => (s ? s : undefined));

/**
 * Indian registration: state code + RTO + series + 1–4 digits (e.g. UP32AB1282, DL3CAB1234),
 * or a Bharat series plate (22BH1234AB). Spaces/hyphens are stripped and letters upper-cased.
 */
export const REGISTRATION_RE = /^(?:[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/;

export function normaliseRegistration(s: string): string {
  return s.replace(/[\s.-]/g, "").toUpperCase();
}

export const TradeInCreateSchema = z
  .object({
    // Current car
    make: z.string().trim().min(2, "Enter the car's make").max(40),
    modelName: z.string().trim().min(1, "Enter the car's model").max(60),
    variantName: optionalText(60),
    year: z.preprocess(
      toNumberOrUndefined,
      z
        .number({ required_error: "Enter the year", invalid_type_error: "Enter the year" })
        .int("Enter a valid year")
        .min(TRADE_IN_MIN_YEAR, `Year must be ${TRADE_IN_MIN_YEAR} or later`)
        .refine((y) => y <= currentYearIST(), "Year cannot be in the future"),
    ),
    km: z.preprocess(
      toNumberOrUndefined,
      z
        .number({
          required_error: "Enter the kilometres driven",
          invalid_type_error: "Enter the kilometres driven",
        })
        .int("Enter whole kilometres")
        .min(0, "Kilometres cannot be negative")
        .max(TRADE_IN_MAX_KM, "That looks too high — check the odometer reading"),
    ),
    owners: z.preprocess(
      toNumberOrUndefined,
      z
        .number({ invalid_type_error: "Choose the number of owners" })
        .int()
        .min(1, "Choose the number of owners")
        .max(TRADE_IN_MAX_OWNERS, "Choose the number of owners")
        .default(1),
    ),
    fuel: z.enum(TRADE_IN_FUELS).optional().or(z.literal("").transform(() => undefined)),
    registration: z
      .string()
      .optional()
      .transform((s) => (s ? normaliseRegistration(s) : undefined))
      .refine((s) => s === undefined || REGISTRATION_RE.test(s), "Enter a valid registration number, e.g. UP32AB1234"),
    expectedPrice: z.preprocess(
      toNumberOrUndefined,
      z
        .number({ invalid_type_error: "Enter the price in rupees" })
        .int("Enter whole rupees")
        .min(TRADE_IN_MIN_PRICE, "Enter at least ₹10,000")
        .max(TRADE_IN_MAX_PRICE, "Enter at most ₹1 crore")
        .optional(),
    ),
    condition: z.enum(TRADE_IN_CONDITIONS).optional().or(z.literal("").transform(() => undefined)),

    // Car they want to buy (optional)
    interestModelId: optionalId,
    interestVariantId: optionalId,

    // Where / who
    showroomId: optionalId,
    citySlug: optionalId,
    name: NameSchema,
    phone: PhoneSchema,
    email: EmailSchema.optional().or(z.literal("").transform(() => undefined)),
    message: optionalText(1000),
    locale: LocaleEnum.default("en"),
    consent: ConsentSchema,
  })
  .superRefine((v, ctx) => {
    // Odometer sanity: more than 1 lakh km per year of age is not plausible for a private car.
    const age = Math.max(1, currentYearIST() - v.year + 1);
    if (v.km > age * 1_00_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["km"],
        message: "That looks too high for the car's age — check the odometer reading",
      });
    }
  });

export type TradeInCreate = z.input<typeof TradeInCreateSchema>;
export type TradeInCreateInput = z.output<typeof TradeInCreateSchema>;

/** Public response: same shape as the enquiry flow (no buyer or car details echoed back). */
export type TradeInCreated = { leadId: string; reference: string };

/** Staff-only view of a lead's trade-in (full registration included). */
export type TradeInDetail = {
  id: string;
  make: string;
  modelName: string;
  variantName: string | null;
  year: number;
  km: number;
  owners: number;
  fuel: (typeof TRADE_IN_FUELS)[number] | null;
  registration: string | null;
  expectedPrice: number | null;
  condition: string | null;
  createdAt: string;
};
