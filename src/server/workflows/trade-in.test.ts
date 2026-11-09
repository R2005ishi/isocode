import { describe, expect, it, vi } from "vitest";

// trade-in.ts imports the db client; these tests only exercise pure helpers.
vi.mock("@/lib/db", () => ({ db: {} }));

import {
  currentYearIST,
  normaliseRegistration,
  REGISTRATION_RE,
  TradeInCreateSchema,
} from "./trade-in.schema";
import { makeTradeInReference, tradeInAckBody, tradeInCarLabel } from "./trade-in";

const base = {
  make: "Maruti Suzuki",
  modelName: "Swift",
  year: 2019,
  km: 45000,
  name: "Asha Verma",
  phone: "9800000099",
  consent: true,
};

function issuesFor(input: Record<string, unknown>) {
  const r = TradeInCreateSchema.safeParse(input);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("TradeInCreateSchema", () => {
  it("accepts a minimal valid request and applies defaults", () => {
    const r = TradeInCreateSchema.parse(base);
    expect(r.owners).toBe(1);
    expect(r.locale).toBe("en");
    expect(r.registration).toBeUndefined();
    expect(r.expectedPrice).toBeUndefined();
  });

  it("parses form strings with Indian digit grouping", () => {
    const r = TradeInCreateSchema.parse({
      ...base,
      year: "2018",
      km: "1,25,000",
      owners: "2",
      expectedPrice: "₹4,50,000",
      phone: "+91 98000 00099",
    });
    expect(r).toMatchObject({ year: 2018, km: 125000, owners: 2, expectedPrice: 450000, phone: "9800000099" });
  });

  it("treats empty optional fields as absent", () => {
    const r = TradeInCreateSchema.parse({
      ...base,
      variantName: "",
      fuel: "",
      condition: "",
      registration: "",
      expectedPrice: "",
      email: "",
      interestModelId: "",
      showroomId: "",
      message: "  ",
    });
    expect(r.variantName).toBeUndefined();
    expect(r.fuel).toBeUndefined();
    expect(r.condition).toBeUndefined();
    expect(r.registration).toBeUndefined();
    expect(r.expectedPrice).toBeUndefined();
    expect(r.email).toBeUndefined();
    expect(r.interestModelId).toBeUndefined();
    expect(r.showroomId).toBeUndefined();
    expect(r.message).toBeUndefined();
  });

  it("requires consent to be literally true", () => {
    expect(issuesFor({ ...base, consent: false })).toHaveProperty("consent");
    expect(issuesFor({ ...base, consent: "true" })).toHaveProperty("consent");
  });

  it("rejects years before 1990 or in the future", () => {
    expect(issuesFor({ ...base, year: 1985 })).toHaveProperty("year");
    expect(issuesFor({ ...base, year: currentYearIST() + 1 })).toHaveProperty("year");
    expect(issuesFor({ ...base, year: currentYearIST(), km: 500 })).toEqual({});
    expect(issuesFor({ ...base, year: "" })).toHaveProperty("year");
  });

  it("rejects negative, absurd or age-implausible odometer readings", () => {
    expect(issuesFor({ ...base, km: -1 })).toHaveProperty("km");
    expect(issuesFor({ ...base, km: 20_00_000 })).toHaveProperty("km");
    // A car registered this year cannot have 3 lakh km.
    expect(issuesFor({ ...base, year: currentYearIST(), km: 3_00_000 })).toHaveProperty("km");
    expect(issuesFor({ ...base, km: 12.5 })).toHaveProperty("km");
  });

  it("bounds the expected price (₹10,000 – ₹1 crore)", () => {
    expect(issuesFor({ ...base, expectedPrice: 5000 })).toHaveProperty("expectedPrice");
    expect(issuesFor({ ...base, expectedPrice: 2_00_00_000 })).toHaveProperty("expectedPrice");
    expect(issuesFor({ ...base, expectedPrice: 4_50_000 })).toEqual({});
  });

  it("bounds owners and validates enums", () => {
    expect(issuesFor({ ...base, owners: 0 })).toHaveProperty("owners");
    expect(issuesFor({ ...base, owners: 10 })).toHaveProperty("owners");
    expect(issuesFor({ ...base, fuel: "STEAM" })).toHaveProperty("fuel");
    expect(issuesFor({ ...base, condition: "MINT" })).toHaveProperty("condition");
  });

  it("normalises and validates Indian registration numbers", () => {
    expect(TradeInCreateSchema.parse({ ...base, registration: "up 32-ab 1234" }).registration).toBe("UP32AB1234");
    expect(TradeInCreateSchema.parse({ ...base, registration: "22 BH 1234 AA" }).registration).toBe("22BH1234AA");
    expect(issuesFor({ ...base, registration: "HELLO" })).toHaveProperty("registration");
    expect(issuesFor({ ...base, registration: "1234UP" })).toHaveProperty("registration");
  });

  it("validates contact fields with the shared contract rules", () => {
    expect(issuesFor({ ...base, phone: "12345" })).toHaveProperty("phone");
    expect(issuesFor({ ...base, name: "A" })).toHaveProperty("name");
    expect(issuesFor({ ...base, email: "not-an-email" })).toHaveProperty("email");
  });
});

describe("registration helpers", () => {
  it("normaliseRegistration strips separators and upper-cases", () => {
    expect(normaliseRegistration("dl 3c.ab-1234")).toBe("DL3CAB1234");
  });
  it("REGISTRATION_RE accepts common formats", () => {
    for (const r of ["UP32AB1282", "DL3CAB1234", "MH12A1", "22BH1234AB"]) expect(REGISTRATION_RE.test(r)).toBe(true);
  });
});

describe("trade-in workflow helpers", () => {
  it("makes TI- references from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) expect(makeTradeInReference()).toMatch(/^TI-[2-9A-HJ-NP-Z]{5}$/);
  });

  it("labels the car without the registration", () => {
    expect(tradeInCarLabel({ year: 2019, make: "Maruti", modelName: "Swift", variantName: "VXi" })).toBe(
      "2019 Maruti Swift VXi",
    );
    expect(tradeInCarLabel({ year: 2019, make: "Maruti", modelName: "Swift", variantName: null })).toBe(
      "2019 Maruti Swift",
    );
  });

  it("builds en/hi acknowledgements with the reference and an opt-out line", () => {
    const en = tradeInAckBody({ locale: "en", name: "Asha", reference: "TI-ABCDE", car: "2019 Maruti Swift" });
    expect(en).toContain("TI-ABCDE");
    expect(en).toContain("STOP");
    const hi = tradeInAckBody({ locale: "hi", name: "आशा", reference: "TI-ABCDE", car: "2019 Maruti Swift" });
    expect(hi).toContain("TI-ABCDE");
    expect(hi).toContain("STOP");
    expect(hi).toMatch(/[ऀ-ॿ]/);
  });
});
