import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leadRow } from "./test-fixtures";

const findUnique = vi.fn();
const create = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    lead: { findUnique: (...a: unknown[]) => findUnique(...a) },
    aiOutput: { create: (...a: unknown[]) => create(...a) },
  },
}));

import { generateSummary, AiLeadNotFoundError } from "./index";
import { AiTimeoutError, MockProvider, setProviderForTests, type AiProvider } from "./provider";
import { parseSummary } from "./summary";

const GOOD = JSON.stringify({
  needs: ["Automatic petrol SUV for family use"],
  budgetBand: "₹12–13 lakh",
  timeline: "Before Diwali",
  fuelPreference: "Petrol",
  missingInfo: ["Finance or cash purchase"],
  confidence: "high",
});

beforeEach(() => {
  findUnique.mockReset().mockResolvedValue(leadRow());
  create
    .mockReset()
    .mockImplementation(({ data }) =>
      Promise.resolve({ id: "ai_1", createdAt: new Date("2026-11-07T10:00:00Z"), ...data }),
    );
});
afterEach(() => setProviderForTests(null));

describe("parseSummary", () => {
  it("strips code fences and validates", () => {
    expect(parseSummary("```json\n" + GOOD + "\n```")?.confidence).toBe("high");
  });
  it("rejects invalid JSON and schema mismatches", () => {
    expect(parseSummary("not json")).toBeNull();
    expect(
      parseSummary('{"needs": "one string", "missingInfo": [], "confidence": "high"}'),
    ).toBeNull();
    expect(parseSummary('{"needs": [], "missingInfo": [], "confidence": "certain"}')).toBeNull();
  });
});

describe("generateSummary", () => {
  it("returns a validated AI summary and stores it", async () => {
    setProviderForTests(new MockProvider(() => GOOD));
    const res = await generateSummary("lead_1", "user_1");
    expect(res).toMatchObject({ id: "ai_1", status: "OK", reason: null, model: "mock" });
    expect(res.summary.timeline).toBe("Before Diwali");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "SUMMARY", status: "OK", leadId: "lead_1" }),
    });
  });

  it("never sends phone or email to the model", async () => {
    findUnique.mockResolvedValue(
      leadRow({ message: "Call me on 9800000001 or mail rohan@example.test, need a sedan" }),
    );
    const mock = new MockProvider(() => GOOD);
    setProviderForTests(mock);
    await generateSummary("lead_1", "user_1");
    const sent = mock.calls[0].prompt + mock.calls[0].system;
    expect(sent).not.toContain("9800000001");
    expect(sent).not.toContain("rohan@example.test");
    expect(sent).toContain("[phone removed]");
    // Only the structured fields we select are sent; the select never asks for phone/email.
    const select = findUnique.mock.calls[0][0].select;
    expect(select.phone).toBeUndefined();
    expect(select.email).toBeUndefined();
  });

  it("invalid JSON → one stricter retry → deterministic low-confidence fallback", async () => {
    const mock = new MockProvider(() => "Sure! Here is the summary: the buyer wants a car.");
    setProviderForTests(mock);
    const res = await generateSummary("lead_1", "user_1");
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[1].prompt).toContain("ONLY a single JSON object");
    expect(res).toMatchObject({ status: "FALLBACK", reason: "invalid_output", model: "template" });
    expect(res.summary.confidence).toBe("low");
    expect(res.summary.missingInfo).toEqual(
      expect.arrayContaining(["Budget", "Purchase timeline"]),
    );
    expect(res.summary.needs).toContain("Interested in Model H ZX Automatic Petrol");
  });

  it("invalid first answer, valid retry → OK", async () => {
    setProviderForTests(new MockProvider(({ call }) => (call === 1 ? "oops" : GOOD)));
    const res = await generateSummary("lead_1", "user_1");
    expect(res.status).toBe("OK");
  });

  it("sparse lead (no message, no notes) is forced to low confidence with known facts only", async () => {
    findUnique.mockResolvedValue(leadRow({ message: null, source: "TEST_DRIVE" }));
    // The model over-claims; we must not pass that through.
    setProviderForTests(new MockProvider(() => GOOD));
    const res = await generateSummary("lead_1", "user_1");
    expect(res.summary.confidence).toBe("low");
    expect(res.summary.budgetBand).toBeUndefined();
    expect(res.summary.timeline).toBeUndefined();
    expect(res.summary.needs).toEqual([
      "Interested in Model H ZX Automatic Petrol",
      "Booked a test drive online",
      "Nearest showroom: Gomti Nagar",
    ]);
    expect(res.reason).toBe("sparse_lead");
  });

  it("consultant notes count as free text (not sparse)", async () => {
    findUnique.mockResolvedValue(
      leadRow({ message: null, activities: [{ type: "NOTE", note: "Wants CNG, budget 9 lakh" }] }),
    );
    setProviderForTests(new MockProvider(() => GOOD));
    const res = await generateSummary("lead_1", "user_1");
    expect(res.summary.confidence).toBe("high");
  });

  it("timeout → FALLBACK timeout", async () => {
    const slow: AiProvider = {
      name: "slow",
      complete: () => Promise.reject(new AiTimeoutError(8000)),
    };
    setProviderForTests(slow);
    const res = await generateSummary("lead_1", "user_1");
    expect(res).toMatchObject({ status: "FALLBACK", reason: "timeout" });
    expect(res.summary.confidence).toBe("low");
  });

  it("no API key → FALLBACK no_api_key (no fake AI text)", async () => {
    setProviderForTests(new MockProvider());
    const res = await generateSummary("lead_1", "user_1");
    expect(res).toMatchObject({ status: "FALLBACK", reason: "no_api_key", model: "template" });
  });

  it("throws AiLeadNotFoundError for an unknown lead", async () => {
    findUnique.mockResolvedValue(null);
    await expect(generateSummary("missing", "user_1")).rejects.toBeInstanceOf(AiLeadNotFoundError);
    await expect(generateSummary("missing", "user_1")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
