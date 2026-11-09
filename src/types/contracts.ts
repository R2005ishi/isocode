/**
 * API contract — DTOs and Zod schemas shared by server and client.
 * Read-only for agents; propose changes to the orchestrator.
 *
 * Route table
 * ───────────────────────────────────────────────────────────────────────────
 * GET    /api/price?variantId&citySlug            → OnRoadBreakup          public
 * GET    /api/slots?showroomId&demoCarId&date     → Slot[]                 public
 * POST   /api/test-drives                         → TestDriveCreated       public (rate-limited, consent)
 * POST   /api/leads                               → LeadCreated            public (rate-limited, consent)
 * GET    /api/leads?status&sla                    → LeadListItem[]         CONSULTANT (own) | ADMIN (all)
 * GET    /api/leads/[id]                          → LeadDetail             CONSULTANT (own) | ADMIN
 * PATCH  /api/leads/[id]                          → LeadDetail             CONSULTANT (own) | ADMIN  (status, reassign)
 * POST   /api/leads/[id]/contact                  → LeadDetail             CONSULTANT (own) | ADMIN
 * POST   /api/leads/[id]/ai/summary               → AiSummaryResult        CONSULTANT (own) | ADMIN
 * POST   /api/leads/[id]/ai/draft                 → AiDraftResult          CONSULTANT (own) | ADMIN
 * POST   /api/leads/[id]/send                     → SendResult             CONSULTANT (own) | ADMIN
 * GET    /api/consultants                         → ConsultantOption[]     CONSULTANT | ADMIN
 * GET/POST/PATCH/DELETE /api/admin/{models,variants,prices,used-cars,users}  ADMIN (used-cars also USED_CAR_MANAGER)
 * GET    /api/admin/lookups                       → cities, showrooms, models+variants   ADMIN
 * GET    /api/used-cars/[id]/price-band           → PriceBandResult        USED_CAR_MANAGER (| ADMIN)
 * POST   /api/optout                              → { ok: true }           public (rate-limited)
 *
 * Errors: always `{ error: { code: ErrorCode, message: string, fields?: Record<string,string> } }`.
 * Money: whole rupees as integers everywhere. Dates: ISO 8601 strings over the wire.
 */
import { z } from "zod";

// ─── Enums (mirror prisma/schema.prisma) ──────────────────────────────────
export const RoleEnum = z.enum(["BUYER", "CONSULTANT", "ADMIN", "USED_CAR_MANAGER"]);
export type Role = z.infer<typeof RoleEnum>;
export const FuelEnum = z.enum(["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"]);
export const TransmissionEnum = z.enum(["MANUAL", "AUTOMATIC"]);
export const UsedCarStatusEnum = z.enum(["AVAILABLE", "BOOKED", "SOLD"]);
export const LeadSourceEnum = z.enum(["WEB", "PORTAL", "SOCIAL", "WALKIN", "TEST_DRIVE", "TRADE_IN"]);
export const LeadStatusEnum = z.enum([
  "NEW",
  "CONTACTED",
  "TEST_DRIVE_BOOKED",
  "NEGOTIATION",
  "WON",
  "LOST",
]);
export type LeadStatus = z.infer<typeof LeadStatusEnum>;
export const LocaleEnum = z.enum(["en", "hi"]);
export type Locale = z.infer<typeof LocaleEnum>;
export const SlaStateEnum = z.enum(["GREEN", "AMBER", "RED", "MET", "BREACHED"]);
export type SlaState = z.infer<typeof SlaStateEnum>;
export const AiStatusEnum = z.enum(["OK", "FALLBACK", "BLOCKED"]);
export type AiStatus = z.infer<typeof AiStatusEnum>;

// ─── Errors ────────────────────────────────────────────────────────────────
export const ErrorCode = z.enum([
  "UNAUTHENTICATED", // 401
  "FORBIDDEN", // 403
  "NOT_FOUND", // 404
  "VALIDATION", // 400
  "CONSENT_REQUIRED", // 400
  "OPTED_OUT", // 409 — buyer opted out, no messages
  "SLOT_TAKEN", // 409
  "SLOT_INVALID", // 400 — past / outside hours / misaligned
  "PRICE_NOT_PUBLISHED", // 404 — no admin price row for that variant+city
  "RATE_LIMITED", // 429
  "CONFLICT", // 409 generic (e.g. duplicate slug)
  "INTERNAL", // 500
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export type ApiError = {
  error: { code: ErrorCode; message: string; fields?: Record<string, string> };
};

// ─── Shared field schemas ──────────────────────────────────────────────────
/** Indian mobile: 10 digits starting 6–9; optional +91 / 0 prefix stripped by the server. */
export const PhoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"));
export const NameSchema = z.string().trim().min(2, "Enter your name").max(80);
export const EmailSchema = z.string().trim().toLowerCase().email().max(120);
/** DPDP: must be literally `true` — the checkbox is unticked by default. */
export const ConsentSchema = z.literal(true, {
  errorMap: () => ({ message: "Please give consent so we can contact you" }),
});
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// ─── Pricing ───────────────────────────────────────────────────────────────
export const PriceQuerySchema = z.object({
  variantId: z.string().min(1),
  citySlug: z.string().min(1),
});
export type PriceLine = {
  key: "exShowroom" | "roadTax" | "registration" | "insurance" | "accessories" | "other";
  label: string; // English label; UI translates by `key`
  amount: number;
  note?: string; // e.g. "10% of ex-showroom"
};
export type OnRoadBreakup = {
  variantId: string;
  citySlug: string;
  cityName: string;
  lines: PriceLine[];
  total: number;
  validUntil: string; // ISO
  isExpired: boolean;
  disclaimer: string;
};

// ─── EMI ───────────────────────────────────────────────────────────────────
export type EmiInput = {
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
};
export type EmiResult = {
  emi: number;
  totalPayable: number;
  totalInterest: number;
};

// ─── Slots & test drives ───────────────────────────────────────────────────
export const SlotQuerySchema = z.object({
  showroomId: z.string().min(1),
  demoCarId: z.string().min(1),
  date: IsoDateSchema,
});
export type Slot = {
  start: string; // ISO (UTC)
  end: string;
  label: string; // "10:00" in IST
  available: boolean;
};

export const TestDriveCreateSchema = z.object({
  showroomId: z.string().min(1),
  demoCarId: z.string().min(1),
  slotStart: z.string().datetime(),
  name: NameSchema,
  phone: PhoneSchema,
  email: EmailSchema.optional().or(z.literal("").transform(() => undefined)),
  locale: LocaleEnum.default("en"),
  consent: ConsentSchema,
});
export type TestDriveCreate = z.input<typeof TestDriveCreateSchema>;
export type TestDriveCreated = {
  bookingId: string;
  reference: string;
  slotStart: string;
  slotEnd: string;
  showroomName: string;
  carLabel: string;
  consultantName: string | null;
  acknowledgement: { channel: "WHATSAPP"; body: string };
};

// ─── Leads ─────────────────────────────────────────────────────────────────
export const LeadCreateSchema = z.object({
  name: NameSchema,
  phone: PhoneSchema,
  email: EmailSchema.optional().or(z.literal("").transform(() => undefined)),
  interestModelId: z.string().optional(),
  interestVariantId: z.string().optional(),
  interestUsedCarId: z.string().optional(),
  showroomId: z.string().optional(),
  citySlug: z.string().optional(),
  message: z.string().trim().max(1000).optional(),
  locale: LocaleEnum.default("en"),
  consent: ConsentSchema,
});
export type LeadCreate = z.input<typeof LeadCreateSchema>;
export type LeadCreated = { leadId: string; reference: string };

export const LeadListQuerySchema = z.object({
  status: LeadStatusEnum.optional(),
  sla: SlaStateEnum.optional(),
  scope: z.enum(["mine", "all"]).default("mine"),
});
export type LeadListItem = {
  id: string;
  name: string;
  phoneMasked: string;
  source: z.infer<typeof LeadSourceEnum>;
  status: LeadStatus;
  interest: string | null; // "Model H ZX AT" or "Used: UC-1182 Model C"
  showroomName: string | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
  firstContactAt: string | null;
  sla: SlaState;
  optedOut: boolean;
  /** Third-party portal for PORTAL (imported) leads, e.g. "CarDekho". */
  portalName?: string | null;
};

export type LeadActivityDto = {
  id: string;
  type: string;
  note: string;
  actorName: string | null;
  createdAt: string;
};

export type LeadDetail = LeadListItem & {
  phone: string; // full phone is visible to the assigned consultant/admin only
  email: string | null;
  locale: Locale;
  message: string | null;
  citySlug: string | null;
  consent: boolean;
  consentAt: string | null;
  interestModelId: string | null;
  interestVariantId: string | null;
  interestUsedCarId: string | null;
  showroomId: string | null;
  activities: LeadActivityDto[];
  bookings: { id: string; reference: string; slotStart: string; carLabel: string; status: string }[];
  latestSummary: AiSummaryResult | null;
  latestDraft: AiDraftResult | null;
  messages: { id: string; channel: string; body: string; createdAt: string }[];
};

export const LeadPatchSchema = z
  .object({
    status: LeadStatusEnum.optional(),
    assignedToId: z.string().min(1).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.status || v.assignedToId || v.note, { message: "Nothing to update" });
export type LeadPatch = z.infer<typeof LeadPatchSchema>;

export const LeadContactSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export type ConsultantOption = {
  id: string;
  name: string;
  showroomName: string | null;
  openLeads: number;
};

// ─── AI ────────────────────────────────────────────────────────────────────
export const AiSummarySchema = z.object({
  needs: z.array(z.string().max(160)).max(8),
  budgetBand: z.string().max(80).optional(),
  timeline: z.string().max(80).optional(),
  fuelPreference: z.string().max(40).optional(),
  missingInfo: z.array(z.string().max(120)).max(8),
  confidence: z.enum(["low", "medium", "high"]),
});
export type AiSummary = z.infer<typeof AiSummarySchema>;
export type AiSummaryResult = {
  id: string;
  status: AiStatus;
  reason: string | null;
  summary: AiSummary;
  model: string;
  createdAt: string;
};

export const AiDraftRequestSchema = z.object({
  locale: LocaleEnum.optional(), // defaults to lead.locale
});
export type AiDraftResult = {
  id: string;
  status: AiStatus;
  reason: string | null; // e.g. "discount_language", "unverified_price", "timeout", "no_api_key"
  text: string;
  locale: Locale;
  model: string;
  createdAt: string;
};

export const SendSchema = z.object({
  aiOutputId: z.string().optional(),
  text: z.string().trim().min(5).max(1500),
  channel: z.enum(["WHATSAPP", "SMS"]).default("WHATSAPP"),
});
export type SendResult = { messageId: string; sentAt: string };

export type PriceBandResult =
  | { ok: true; low: number; median: number; high: number; comparables: number }
  | { ok: false; reason: "NOT_ENOUGH_COMPARABLES"; comparables: number };

// ─── Opt-out ───────────────────────────────────────────────────────────────
export const OptOutSchema = z.object({ phone: PhoneSchema });

// ─── Public catalogue DTOs (used by server components and APIs) ───────────
export type UsedCarPublic = {
  id: string;
  stockId: string;
  slug: string;
  modelName: string;
  variantName: string;
  fuel: z.infer<typeof FuelEnum>;
  transmission: z.infer<typeof TransmissionEnum>;
  year: number;
  km: number;
  owners: number;
  price: number;
  status: z.infer<typeof UsedCarStatusEnum>;
  registrationMasked: string; // NEVER the full number
  colour: string | null;
  images: string[];
  inspection: { item: string; result: "OK" | "ATTENTION" | "REPLACED"; note?: string }[];
};

export const UsedCarFilterSchema = z.object({
  model: z.string().optional(),
  fuel: FuelEnum.optional(),
  minYear: z.coerce.number().int().min(2000).max(2100).optional(),
  maxKm: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  status: UsedCarStatusEnum.optional(),
});
export type UsedCarFilter = z.infer<typeof UsedCarFilterSchema>;

// ─── Admin ─────────────────────────────────────────────────────────────────
const slug = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase-with-dashes");

export const AdminModelSchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug,
  bodyType: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(2000),
  descriptionHi: z.string().trim().max(2000).optional(),
  heroImage: z.string().trim().min(1).max(300),
  gallery: z.array(z.string().trim().max(300)).max(12).default([]),
  isActive: z.boolean().default(true),
});

export const ColourSchema = z.object({
  name: z.string().max(40),
  nameHi: z.string().max(40).optional(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const AdminVariantSchema = z.object({
  modelId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  slug,
  code: z.string().trim().max(30).optional(),
  fuel: FuelEnum,
  transmission: TransmissionEnum,
  exShowroomPrice: z.number().int().min(100_000).max(50_000_000),
  specs: z.record(z.string(), z.union([z.string(), z.number()])),
  colours: z.array(ColourSchema).max(12),
  isActive: z.boolean().default(true),
});

export const AdminPriceSchema = z.object({
  variantId: z.string().min(1),
  cityId: z.string().min(1),
  roadTaxPct: z.number().min(0).max(30),
  registrationFee: z.number().int().min(0).max(500_000),
  insurance: z.number().int().min(0).max(2_000_000),
  accessoriesPack: z.number().int().min(0).max(1_000_000),
  otherCharges: z.number().int().min(0).max(1_000_000).default(0),
  validUntil: z.string().datetime({ offset: true }).or(IsoDateSchema),
});

export const InspectionItemSchema = z.object({
  item: z.string().trim().min(1).max(60),
  result: z.enum(["OK", "ATTENTION", "REPLACED"]),
  note: z.string().trim().max(200).optional(),
});
export const AdminUsedCarSchema = z.object({
  stockId: z.string().trim().min(1).max(20),
  slug,
  modelName: z.string().trim().min(1).max(60),
  variantName: z.string().trim().min(1).max(60),
  fuel: FuelEnum,
  transmission: TransmissionEnum.default("MANUAL"),
  year: z.number().int().min(2000).max(2100),
  km: z.number().int().min(0).max(1_000_000),
  owners: z.number().int().min(1).max(10),
  price: z.number().int().min(10_000).max(50_000_000),
  status: UsedCarStatusEnum,
  registration: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{1,4}$/, "e.g. UP32 AB 1234"),
  colour: z.string().trim().max(30).optional(),
  images: z.array(z.string().trim().max(300)).max(12).default([]),
  inspection: z.array(InspectionItemSchema).max(30).default([]),
});

export const AdminUserSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  role: RoleEnum,
  showroomId: z.string().optional().nullable(),
  phone: z.string().trim().max(15).optional(),
  password: z.string().min(8).max(100).optional(), // required on create, optional on update
  isActive: z.boolean().default(true),
  /** Model ids this consultant specialises in (model-aware auto-assignment). */
  specialtyModelIds: z.array(z.string()).max(50).optional(),
});

/** Partial schemas for PATCH. */
export const AdminModelPatchSchema = AdminModelSchema.partial();
export const AdminVariantPatchSchema = AdminVariantSchema.partial();
export const AdminPricePatchSchema = AdminPriceSchema.partial();
export const AdminUsedCarPatchSchema = AdminUsedCarSchema.partial();
export const AdminUserPatchSchema = AdminUserSchema.partial();
