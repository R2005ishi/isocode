import { describe, expect, it } from "vitest";
import { buildFallbackDraft, type TemplateInput } from "./draft-template";
import { findDiscountLanguage, findUnverifiedRupees } from "./guardrails";

const full: TemplateInput = {
  locale: "en",
  firstName: "Rohan",
  consultantName: "Asha Verma",
  showroomName: "Gomti Nagar",
  carOfInterest: "Model H ZX Automatic Petrol",
  slotLabels: ["Sat, 8 Nov, 11:00 am", "Sun, 9 Nov, 10:00 am", "Mon, 10 Nov, 10:00 am"],
  price: { cityName: "Lucknow", total: "₹12,62,300", validUntil: "30 Nov 2026" },
};
const sparse: TemplateInput = {
  ...full,
  consultantName: null,
  showroomName: null,
  carOfInterest: null,
  slotLabels: [],
  price: null,
};
const allowed = [1_262_300];

describe("fallback draft template", () => {
  for (const locale of ["en", "hi"] as const) {
    for (const [name, input] of [
      ["full", full],
      ["sparse", sparse],
    ] as const) {
      it(`${locale}/${name} passes both guardrails`, () => {
        const text = buildFallbackDraft({ ...input, locale });
        expect(findDiscountLanguage(text)).toEqual([]);
        expect(findUnverifiedRupees(text, input.price ? allowed : [])).toEqual([]);
        expect(text).toContain("Rohan");
      });
    }
  }

  it("names consultant, showroom, slots and price", () => {
    const text = buildFallbackDraft(full);
    expect(text).toContain("Asha Verma");
    expect(text).toContain("Gomti Nagar");
    expect(text).toContain("Sun, 9 Nov, 10:00 am");
    expect(text).toContain("₹12,62,300");
    expect(text).toContain("prices may change");
  });

  it("invites the buyer to pick a time when there are no slots, and quotes no price", () => {
    const text = buildFallbackDraft(sparse);
    expect(text).toMatch(/reply with a day and time/);
    expect(text).not.toMatch(/₹/);
  });

  it("Hindi template is in Devanagari", () => {
    const text = buildFallbackDraft({ ...full, locale: "hi" });
    expect(text).toMatch(/नमस्ते Rohan जी/);
    expect(text).toContain("कीमतें बदल सकती हैं");
  });

  it("stays within ~90 words", () => {
    expect(buildFallbackDraft(full).split(/\s+/).length).toBeLessThanOrEqual(90);
  });
});
