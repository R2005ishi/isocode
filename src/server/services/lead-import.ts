/**
 * Portal CSV lead import — pure mapping of parsed CSV rows to validated lead inputs. [client-safe]
 * The db-backed workflow lives in `src/server/workflows/lead-import.ts`.
 *
 * Row numbers are spreadsheet-style: the header is row 1, the first data record is row 2.
 */
import { z } from "zod";
import { normaliseHeader, parseCsv } from "./csv";

export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 1_000_000; // 1 MB of CSV text
export const PORTAL_SUGGESTIONS = [
  "CarDekho",
  "CarWale",
  "OLX Autos",
  "Cars24",
  "ZigWheels",
  "Spinny",
];

export const LeadImportRequestSchema = z.object({
  fileName: z.string().trim().min(1, "Choose a file").max(200),
  portalName: z.string().trim().min(2, "Enter the portal name").max(60),
  csvText: z
    .string()
    .min(1, "The file is empty")
    .refine((s) => s.length <= IMPORT_MAX_BYTES, "File is larger than 1 MB"),
  defaultShowroomId: z.string().trim().min(1).optional().nullable(),
  dryRun: z.boolean().default(false),
});
export type LeadImportRequest = z.input<typeof LeadImportRequestSchema>;

export type ImportField =
  | "name"
  | "phone"
  | "email"
  | "city"
  | "model"
  | "variant"
  | "showroom"
  | "message"
  | "externalRef"
  | "createdAt";

/** Accepted header synonyms, already normalised (lowercase, alphanumerics only). */
export const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  name: ["name", "customername", "fullname", "customer", "buyername", "leadname", "contactname"],
  phone: [
    "phone",
    "mobile",
    "contact",
    "phonenumber",
    "mobilenumber",
    "contactnumber",
    "mobileno",
    "phoneno",
    "contactno",
    "whatsapp",
  ],
  email: ["email", "emailid", "emailaddress", "mail"],
  city: ["city", "location", "customercity"],
  model: ["model", "carmodel", "modelname", "interestedmodel", "car"],
  variant: ["variant", "carvariant", "variantname", "trim", "version"],
  showroom: ["showroom", "showroomname", "dealer", "dealership", "outlet", "branch"],
  message: ["message", "comments", "comment", "remarks", "remark", "notes", "query", "enquiry"],
  externalRef: [
    "leadid",
    "externalid",
    "enquiryid",
    "inquiryid",
    "refid",
    "reference",
    "referenceid",
    "ref",
    "id",
  ],
  createdAt: ["created", "date", "createdat", "createdon", "enquirydate", "leaddate", "datetime"],
};

export type ImportLookups = {
  cities: { name: string; slug: string }[];
  showrooms: { id: string; name: string; slug: string; citySlug?: string | null }[];
  models: {
    id: string;
    name: string;
    slug: string;
    variants: { id: string; name: string; slug: string; code?: string | null }[];
  }[];
};

export type ImportRowIssue = { row: number; reason: string };

export type MappedLead = {
  row: number;
  name: string;
  phone: string;
  email: string | null;
  citySlug: string | null;
  modelId: string | null;
  variantId: string | null;
  showroomId: string | null;
  message: string | null;
  externalRef: string | null;
  /** The portal's own enquiry timestamp (informational; the lead's SLA starts at import). */
  portalCreatedAt: Date | null;
};

export type MapResult = {
  headerMap: Partial<Record<ImportField, string>>;
  ignoredHeaders: string[];
  totalRows: number;
  valid: MappedLead[];
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
};

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Indian mobile → 10 digits starting 6–9, or null. Strips spaces, dashes, dots, brackets, +91/91/0091/0. */
export function normaliseIndianPhone(raw: string): string | null {
  let s = (raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d+$/.test(s)) return null;
  if (s.length === 14 && s.startsWith("0091")) s = s.slice(4);
  else if (s.length === 12 && s.startsWith("91")) s = s.slice(2);
  else if (s.length === 11 && s.startsWith("0")) s = s.slice(1);
  return /^[6-9]\d{9}$/.test(s) ? s : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ISO (`2026-11-08`, `2026-11-08 14:30`, with or without zone) or `DD/MM/YYYY`, `DD-MM-YYYY`,
 * `DD.MM.YYYY` with optional `HH:mm[:ss] [am|pm]`. Zone-less times are IST. Null if unparseable.
 */
export function parsePortalDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const build = (y: number, mon: number, day: number, h: number, mi: number, sec: number) => {
    if (mon < 1 || mon > 12 || day < 1 || h > 23 || mi > 59 || sec > 59) return null;
    if (new Date(Date.UTC(y, mon - 1, day)).getUTCDate() !== day) return null; // e.g. 31/02
    return new Date(Date.UTC(y, mon - 1, day, h, mi, sec) - 330 * 60_000); // IST → UTC
  };
  const dmy = s.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i,
  );
  if (dmy) {
    const [, d, m, y, hh, mm, ss, ap] = dmy;
    let h = hh ? Number(hh) : 0;
    if (ap) h = (h % 12) + (ap.toLowerCase() === "pm" ? 12 : 0);
    return build(Number(y), Number(m), Number(d), h, Number(mm ?? 0), Number(ss ?? 0));
  }
  const iso = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (iso) {
    const [, y, m, d, hh, mm, ss, zone] = iso;
    if (zone) {
      const dt = new Date(s.replace(" ", "T"));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    return build(
      Number(y),
      Number(m),
      Number(d),
      Number(hh ?? 0),
      Number(mm ?? 0),
      Number(ss ?? 0),
    );
  }
  return null;
}

/** Exact slug/name match first, then a unique "contains" match (e.g. "BrandX Model H" → Model H). */
function matchOne<T extends { name: string; slug: string; code?: string | null }>(
  items: T[],
  raw: string,
): T | null {
  const k = key(raw);
  if (!k) return null;
  const exact = items.find(
    (i) => key(i.slug) === k || key(i.name) === k || (i.code ? key(i.code) === k : false),
  );
  if (exact) return exact;
  const partial = items.filter((i) => {
    const n = key(i.name);
    return n.length >= 3 && (k.includes(n) || n.includes(k)) && k.length >= 3;
  });
  return partial.length === 1 ? partial[0]! : null;
}

export function buildHeaderMap(headers: string[]): {
  index: Partial<Record<ImportField, number>>;
  headerMap: Partial<Record<ImportField, string>>;
  ignored: string[];
} {
  const index: Partial<Record<ImportField, number>> = {};
  const headerMap: Partial<Record<ImportField, string>> = {};
  const ignored: string[] = [];
  headers.forEach((h, i) => {
    const n = normaliseHeader(h);
    const field = (Object.keys(HEADER_SYNONYMS) as ImportField[]).find(
      (f) => index[f] === undefined && HEADER_SYNONYMS[f].includes(n),
    );
    if (field) {
      index[field] = i;
      headerMap[field] = h.trim();
    } else if (h.trim()) ignored.push(h.trim());
  });
  return { index, headerMap, ignored };
}

/**
 * Parses CSV text and maps each record to a validated lead input. Bad rows are reported (row number +
 * reason), never fatal; a structurally bad file (no header, missing name/phone column, too many rows)
 * throws `ImportFileError`.
 */
export function mapCsvToLeads(
  csvText: string,
  lookups: ImportLookups,
  opts: { defaultShowroomId?: string | null } = {},
): MapResult {
  if (csvText.length > IMPORT_MAX_BYTES) throw new ImportFileError("File is larger than 1 MB");
  let rows: string[][];
  try {
    rows = parseCsv(csvText);
  } catch (e) {
    throw new ImportFileError(e instanceof Error ? e.message : "Could not read the CSV file");
  }
  if (rows.length === 0) throw new ImportFileError("The file is empty");
  const [headers, ...data] = rows as [string[], ...string[][]];
  const { index, headerMap, ignored } = buildHeaderMap(headers);
  const missing = (["name", "phone"] as const).filter((f) => index[f] === undefined);
  if (missing.length) {
    throw new ImportFileError(
      `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. ` +
        `Found: ${
          headers
            .map((h) => h.trim())
            .filter(Boolean)
            .join(", ") || "none"
        }`,
    );
  }
  if (data.length === 0) throw new ImportFileError("The file has a header but no data rows");
  if (data.length > IMPORT_MAX_ROWS) {
    throw new ImportFileError(
      `Too many rows (${data.length}). The limit is ${IMPORT_MAX_ROWS} per file.`,
    );
  }

  const defaultShowroom = opts.defaultShowroomId
    ? (lookups.showrooms.find((s) => s.id === opts.defaultShowroomId) ?? null)
    : null;
  const allVariants = lookups.models.flatMap((m) =>
    m.variants.map((v) => ({ ...v, modelId: m.id })),
  );

  const valid: MappedLead[] = [];
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];
  const seenRefs = new Set<string>();
  const seenPhones = new Set<string>();

  data.forEach((cells, i) => {
    const row = i + 2;
    const get = (f: ImportField) => {
      const idx = index[f];
      return idx === undefined ? "" : (cells[idx] ?? "").trim();
    };
    const warn = (reason: string) => warnings.push({ row, reason });

    const name = get("name").replace(/\s+/g, " ");
    const rawPhone = get("phone");
    if (!name && !rawPhone && cells.every((c) => !c.trim())) return; // blank row of commas
    if (name.length < 2) return void errors.push({ row, reason: "Name is missing" });
    if (name.length > 80)
      return void errors.push({ row, reason: "Name is longer than 80 characters" });
    if (!rawPhone) return void errors.push({ row, reason: "Phone is missing" });
    const phone = normaliseIndianPhone(rawPhone);
    if (!phone)
      return void errors.push({ row, reason: `Invalid Indian mobile number "${rawPhone}"` });

    const externalRef = get("externalRef").slice(0, 100) || null;
    if (externalRef) {
      if (seenRefs.has(externalRef))
        return void errors.push({ row, reason: `Duplicate lead id ${externalRef} in this file` });
      seenRefs.add(externalRef);
    }
    if (seenPhones.has(phone))
      return void errors.push({ row, reason: "Duplicate phone in this file" });
    seenPhones.add(phone);

    let email: string | null = get("email").toLowerCase() || null;
    if (email && (!EMAIL_RE.test(email) || email.length > 120)) {
      warn(`Email "${email}" ignored (invalid)`);
      email = null;
    }

    // Catalogue references: unknown values are kept in the message so nothing is lost.
    const extras: string[] = [];
    const rawModel = get("model");
    const rawVariant = get("variant");
    let model = rawModel ? matchOne(lookups.models, rawModel) : null;
    if (rawModel && !model) {
      warn(`Unknown model "${rawModel}"`);
      extras.push(`Model: ${rawModel}`);
    }
    let variantId: string | null = null;
    if (rawVariant) {
      const pool = model ? allVariants.filter((v) => v.modelId === model!.id) : allVariants;
      const v = matchOne(pool, rawVariant);
      if (v) {
        variantId = v.id;
        if (!model) model = lookups.models.find((m) => m.id === v.modelId) ?? null;
      } else {
        warn(`Unknown variant "${rawVariant}"`);
        extras.push(`Variant: ${rawVariant}`);
      }
    }

    const rawCity = get("city");
    const city = rawCity ? matchOne(lookups.cities, rawCity) : null;
    if (rawCity && !city) {
      warn(`Unknown city "${rawCity}"`);
      extras.push(`City: ${rawCity}`);
    }

    const rawShowroom = get("showroom");
    let showroom = rawShowroom ? matchOne(lookups.showrooms, rawShowroom) : null;
    if (rawShowroom && !showroom) {
      warn(`Unknown showroom "${rawShowroom}"`);
      extras.push(`Showroom: ${rawShowroom}`);
    }
    if (!showroom) showroom = defaultShowroom;
    if (!showroom && city)
      showroom = lookups.showrooms.find((s) => s.citySlug === city.slug) ?? null;

    const rawDate = get("createdAt");
    const portalCreatedAt = rawDate ? parsePortalDate(rawDate) : null;
    if (rawDate && !portalCreatedAt) warn(`Date "${rawDate}" not recognised`);

    const base = get("message");
    const message = [base, extras.length ? `[Portal data] ${extras.join("; ")}` : ""]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1000);

    valid.push({
      row,
      name,
      phone,
      email,
      citySlug: city?.slug ?? null,
      modelId: model?.id ?? null,
      variantId,
      showroomId: showroom?.id ?? null,
      message: message || null,
      externalRef,
      portalCreatedAt,
    });
  });

  return { headerMap, ignoredHeaders: ignored, totalRows: data.length, valid, errors, warnings };
}

/** Canonical casing for well-known portals ("cardekho" → "CarDekho"); otherwise trimmed input. */
export function canonicalPortalName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  return PORTAL_SUGGESTIONS.find((p) => key(p) === key(s)) ?? s;
}

export const SAMPLE_CSV_HEADERS = [
  "Lead ID",
  "Customer Name",
  "Mobile",
  "Email",
  "City",
  "Car Model",
  "Variant",
  "Showroom",
  "Remarks",
  "Created",
];

// ─── Wire shapes (API ↔ UI) ────────────────────────────────────────────────
export type LeadImportPreviewRow = {
  row: number;
  name: string;
  phoneMasked: string;
  model: string | null;
  variant: string | null;
  showroom: string | null;
  city: string | null;
  externalRef: string | null;
  outcome: "create" | "skip";
  reason?: string;
};

export type LeadImportResult = {
  dryRun: boolean;
  importId: string | null;
  portalName: string;
  fileName: string;
  totalRows: number;
  /** Leads created (or that would be created, on a dry run). */
  createdCount: number;
  skippedCount: number;
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
  headerMap: Partial<Record<ImportField, string>>;
  ignoredHeaders: string[];
  preview: LeadImportPreviewRow[];
};

export type LeadImportSummary = {
  id: string;
  fileName: string;
  portalName: string;
  importedBy: { id: string; name: string } | null;
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  errors: ImportRowIssue[];
  createdAt: string;
};
