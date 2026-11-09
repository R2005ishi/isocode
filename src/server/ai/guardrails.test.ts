import { describe, expect, it } from "vitest";
import { extractRupeeAmounts, findDiscountLanguage, findUnverifiedRupees } from "./guardrails";

describe("findDiscountLanguage", () => {
  it.each([
    "We can give you a discount this week",
    "Get 5% off on the ZX",
    "Flat ₹20,000 off for you",
    "Rs. 15000 off if you book today",
    "Plus cashback of ₹10,000",
    "Cash back available",
    "Great offers running now",
    "Free accessories with every booking",
    "A special price just for you",
    "Best price guaranteed",
    "Best deal in Lucknow",
    "Price is negotiable",
  ])("flags English: %s", (text) => {
    expect(findDiscountLanguage(text).length).toBeGreaterThan(0);
  });

  it.each([
    "इस हफ्ते खास छूट मिल रही है",
    "दिवाली ऑफर चल रहा है",
    "नया ऑफ़र देखें",
    "आपको डिस्काउंट मिलेगा",
    "₹10,000 कैशबैक",
  ])("flags Hindi: %s", (text) => {
    expect(findDiscountLanguage(text).length).toBeGreaterThan(0);
  });

  it("does not flag a normal reply", () => {
    expect(
      findDiscountLanguage(
        "Hi Rohan, this is Asha from Brand X Gomti Nagar. Can I book a test drive for you on Sat 8 Nov, 11:00 am? The on-road price is ₹12,45,000.",
      ),
    ).toEqual([]);
    expect(findDiscountLanguage("नमस्ते रोहन जी, ऑन-रोड कीमत ₹12,45,000 है।")).toEqual([]);
  });
});

describe("extractRupeeAmounts", () => {
  it("normalises every supported format", () => {
    const values = extractRupeeAmounts(
      "₹12,45,000 or Rs. 1245000 or INR 9,99,999, about 12.45 lakh, 12 लाख, 1.2 crore, 50000 rupees, ₹१२,४५,०००",
    ).map((m) => m.value);
    expect(values).toEqual([1245000, 1245000, 999999, 1245000, 1200000, 12000000, 50000, 1245000]);
  });

  it("treats ₹12.45 lakh as a single amount", () => {
    expect(extractRupeeAmounts("₹12.45 lakh")).toEqual([
      { raw: "₹12.45 lakh", value: 1245000, precision: 1000 },
    ]);
  });

  it("ignores times, dates and percentages", () => {
    expect(
      extractRupeeAmounts("Sat 8 Nov, 11:15 am, road tax 10%, valid till 30 Nov 2026"),
    ).toEqual([]);
  });
});

describe("findUnverifiedRupees", () => {
  const allowed = [1_100_000, 110_000, 2_100, 35_200, 15_000, 1_262_300];

  it("allows exact figures from the breakup", () => {
    expect(findUnverifiedRupees("Ex-showroom ₹11,00,000, total ₹12,62,300", allowed)).toEqual([]);
    expect(findUnverifiedRupees("Total Rs. 1262300", allowed)).toEqual([]);
  });

  it("allows lakh format when it is an allowed figure rounded to the precision shown", () => {
    expect(findUnverifiedRupees("about ₹12.62 lakh on-road", allowed)).toEqual([]);
    expect(findUnverifiedRupees("कुल 12.62 लाख", allowed)).toEqual([]);
    expect(findUnverifiedRupees("ex-showroom 11 lakh", allowed)).toEqual([]);
  });

  it("flags a wrong figure", () => {
    expect(findUnverifiedRupees("Total ₹11,99,000 only", allowed)).toEqual(["₹11,99,000"]);
    expect(findUnverifiedRupees("about 12.9 lakh", allowed)).toEqual(["12.9 lakh"]);
  });

  it("flags every rupee amount when no price is available", () => {
    expect(findUnverifiedRupees("Starts at ₹9,99,000", [])).toEqual(["₹9,99,000"]);
  });
});
