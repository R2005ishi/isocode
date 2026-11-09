import { describe, expect, it } from "vitest";
import {
  buildHeaderMap,
  canonicalPortalName,
  IMPORT_MAX_ROWS,
  ImportFileError,
  LeadImportRequestSchema,
  mapCsvToLeads,
  normaliseIndianPhone,
  parsePortalDate,
  type ImportLookups,
} from "./lead-import";

const lookups: ImportLookups = {
  cities: [
    { name: "Lucknow", slug: "lucknow" },
    { name: "Kanpur", slug: "kanpur" },
  ],
  showrooms: [
    { id: "sr-gomti", name: "BrandX Gomti Nagar", slug: "gomti-nagar", citySlug: "lucknow" },
    { id: "sr-hazrat", name: "BrandX Hazratganj", slug: "hazratganj", citySlug: "lucknow" },
    {
      id: "sr-kanpur",
      name: "BrandX Kanpur Mall Road",
      slug: "kanpur-mall-road",
      citySlug: "kanpur",
    },
  ],
  models: [
    {
      id: "m-h",
      name: "Model H",
      slug: "model-h",
      variants: [
        { id: "v-h1", name: "ZX Automatic Petrol", slug: "zx-automatic-petrol", code: "NEW-H-02" },
        { id: "v-h2", name: "SX Manual Diesel", slug: "sx-manual-diesel" },
      ],
    },
    {
      id: "m-c",
      name: "Model C",
      slug: "model-c",
      variants: [{ id: "v-c1", name: "VX Diesel", slug: "vx-diesel" }],
    },
  ],
};

const csv = (...lines: string[]) => lines.join("\r\n");

describe("normaliseIndianPhone", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["+91-98765-43210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["0091 9876543210", "9876543210"],
    ["(987) 654-3210", "9876543210"],
  ])("%s → %s", (raw, out) => expect(normaliseIndianPhone(raw)).toBe(out));

  it.each(["5876543210", "98765", "98765432101", "abc9876543210", "", "+1 9876543210"])(
    "rejects %s",
    (raw) => expect(normaliseIndianPhone(raw)).toBeNull(),
  );
});

describe("parsePortalDate", () => {
  it("parses DD/MM/YYYY as IST", () => {
    expect(parsePortalDate("08/11/2026")?.toISOString()).toBe("2026-11-07T18:30:00.000Z");
    expect(parsePortalDate("08-11-2026 10:30")?.toISOString()).toBe("2026-11-08T05:00:00.000Z");
    expect(parsePortalDate("8/11/2026 2:05 pm")?.toISOString()).toBe("2026-11-08T08:35:00.000Z");
  });
  it("parses ISO with and without zone", () => {
    expect(parsePortalDate("2026-11-08")?.toISOString()).toBe("2026-11-07T18:30:00.000Z");
    expect(parsePortalDate("2026-11-08 16:05")?.toISOString()).toBe("2026-11-08T10:35:00.000Z");
    expect(parsePortalDate("2026-11-08T10:00:00Z")?.toISOString()).toBe(
      "2026-11-08T10:00:00.000Z",
    );
  });
  it("rejects garbage and impossible dates", () => {
    expect(parsePortalDate("yesterday")).toBeNull();
    expect(parsePortalDate("31/02/2026")).toBeNull();
    expect(parsePortalDate("01/13/2026")).toBeNull();
  });
});

describe("buildHeaderMap", () => {
  it("maps synonyms case/space-insensitively and lists ignored headers", () => {
    const r = buildHeaderMap([
      "Customer Name",
      "MOBILE",
      "E-mail",
      "Car Model",
      "Enquiry ID",
      "Budget",
    ]);
    expect(r.index).toMatchObject({ name: 0, phone: 1, email: 2, model: 3, externalRef: 4 });
    expect(r.ignored).toEqual(["Budget"]);
  });
  it("uses the first matching column when two map to the same field", () => {
    const r = buildHeaderMap(["Phone", "Mobile", "Name"]);
    expect(r.index.phone).toBe(0);
    expect(r.ignored).toEqual(["Mobile"]);
  });
});

describe("mapCsvToLeads", () => {
  it("maps a valid row and resolves model, variant, city and showroom", () => {
    const r = mapCsvToLeads(
      csv(
        "Lead ID,Customer Name,Mobile,Email,City,Car Model,Variant,Showroom,Remarks,Created",
        "CD-1,Priya  Sharma,+91 98765 43210,PRIYA@Example.com,Lucknow,model-h,ZX Automatic Petrol,Gomti Nagar,Weekend test drive,08/11/2026 10:30",
      ),
      lookups,
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.totalRows).toBe(1);
    expect(r.valid[0]).toEqual({
      row: 2,
      name: "Priya Sharma",
      phone: "9876543210",
      email: "priya@example.com",
      citySlug: "lucknow",
      modelId: "m-h",
      variantId: "v-h1",
      showroomId: "sr-gomti",
      message: "Weekend test drive",
      externalRef: "CD-1",
      portalCreatedAt: new Date("2026-11-08T05:00:00.000Z"),
    });
  });

  it("derives the model from a variant (by code) when model is blank", () => {
    const r = mapCsvToLeads(csv("name,phone,variant", "Amit,9812345678,NEW-H-02"), lookups);
    expect(r.valid[0]).toMatchObject({ modelId: "m-h", variantId: "v-h1" });
  });

  it("matches a model name with a brand prefix", () => {
    const r = mapCsvToLeads(csv("name,phone,model", "Amit,9812345678,BrandX Model C"), lookups);
    expect(r.valid[0]!.modelId).toBe("m-c");
  });

  it("reports invalid rows with row numbers, without failing the batch", () => {
    const r = mapCsvToLeads(
      csv(
        "name,phone",
        "Good One,9812345678",
        ",9812345679",
        "No Phone,",
        "Bad Phone,12345",
        "Ok Two,7812345678",
      ),
      lookups,
    );
    expect(r.valid.map((v) => v.row)).toEqual([2, 6]);
    expect(r.errors).toEqual([
      { row: 3, reason: "Name is missing" },
      { row: 4, reason: "Phone is missing" },
      { row: 5, reason: 'Invalid Indian mobile number "12345"' },
    ]);
  });

  it("skips duplicate lead ids and phones within the file", () => {
    const r = mapCsvToLeads(
      csv("lead id,name,phone", "A1,One,9812345678", "A1,Two,9812345670", "A2,Three,09812345678"),
      lookups,
    );
    expect(r.valid).toHaveLength(1);
    expect(r.errors).toEqual([
      { row: 3, reason: "Duplicate lead id A1 in this file" },
      { row: 4, reason: "Duplicate phone in this file" },
    ]);
  });

  it("warns on unknown references and keeps them in the message", () => {
    const r = mapCsvToLeads(
      csv(
        "name,phone,model,city,showroom,email,message",
        "Ravi,9812345678,Model Z,Agra,Nowhere,bad-email,Call me",
      ),
      lookups,
    );
    const v = r.valid[0]!;
    expect(v).toMatchObject({ modelId: null, citySlug: null, showroomId: null, email: null });
    expect(v.message).toBe("Call me\n[Portal data] Model: Model Z; City: Agra; Showroom: Nowhere");
    expect(r.warnings.map((w) => w.reason)).toEqual([
      'Email "bad-email" ignored (invalid)',
      'Unknown model "Model Z"',
      'Unknown city "Agra"',
      'Unknown showroom "Nowhere"',
    ]);
  });

  it("falls back to the default showroom, then to a showroom in the row's city", () => {
    const text = csv("name,phone,city", "Anu,9812345678,Kanpur", "Bina,9812345679,");
    const withDefault = mapCsvToLeads(text, lookups, { defaultShowroomId: "sr-hazrat" });
    expect(withDefault.valid.map((v) => v.showroomId)).toEqual(["sr-hazrat", "sr-hazrat"]);
    const byCity = mapCsvToLeads(text, lookups);
    expect(byCity.valid.map((v) => v.showroomId)).toEqual(["sr-kanpur", null]);
  });

  it("ignores rows that are entirely blank (just commas)", () => {
    const r = mapCsvToLeads(csv("name,phone", ",", "Anu,9812345678"), lookups);
    expect(r.valid).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it("throws ImportFileError for structural problems", () => {
    expect(() => mapCsvToLeads("", lookups)).toThrow(ImportFileError);
    expect(() => mapCsvToLeads("name,email\nA,a@b.co", lookups)).toThrow(
      /Missing required column: phone/,
    );
    expect(() => mapCsvToLeads("name,phone\n", lookups)).toThrow(/no data rows/);
    expect(() => mapCsvToLeads('name,phone\n"A,1', lookups)).toThrow(/Unclosed quote/);
    const big = [
      "name,phone",
      ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => "A,9812345678"),
    ];
    expect(() => mapCsvToLeads(big.join("\n"), lookups)).toThrow(/Too many rows/);
  });
});

describe("request schema & portal names", () => {
  it("canonicalises well-known portals", () => {
    expect(canonicalPortalName("  cardekho ")).toBe("CarDekho");
    expect(canonicalPortalName("olx autos")).toBe("OLX Autos");
    expect(canonicalPortalName("My  Portal")).toBe("My Portal");
  });
  it("validates the request and defaults dryRun", () => {
    const ok = LeadImportRequestSchema.parse({
      fileName: "a.csv",
      portalName: "CarWale",
      csvText: "x",
    });
    expect(ok.dryRun).toBe(false);
    expect(
      LeadImportRequestSchema.safeParse({ fileName: "a.csv", portalName: "C", csvText: "x" })
        .success,
    ).toBe(false);
    expect(
      LeadImportRequestSchema.safeParse({
        fileName: "a.csv",
        portalName: "CarWale",
        csvText: "x".repeat(1_000_001),
      }).success,
    ).toBe(false);
  });
});
