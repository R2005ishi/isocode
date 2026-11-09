import { describe, expect, it } from "vitest";
import { computeAiQuality, editBucket, editRatio, wordEditDistance, type DraftRow } from "./ai-quality";

describe("wordEditDistance / editRatio", () => {
  it("is 0 for identical text and ignores whitespace differences", () => {
    expect(wordEditDistance("Hi Ravi, call at 5", "Hi  Ravi,\ncall at 5")).toBe(0);
    expect(editRatio("Hi Ravi", "  Hi Ravi ")).toBe(0);
  });

  it("counts substitutions, insertions and deletions per word", () => {
    expect(wordEditDistance("a b c d", "a x c d")).toBe(1);
    expect(wordEditDistance("a b c d", "a b c d e")).toBe(1);
    expect(wordEditDistance("a b c d", "a c d")).toBe(1);
  });

  it("is relative to the draft length and capped at 1", () => {
    expect(editRatio("one two three four", "one two three FOUR")).toBe(0.25);
    expect(editRatio("short", "a completely different and much longer reply")).toBe(1);
  });

  it("handles an empty draft without dividing by zero", () => {
    expect(editRatio("", "hello")).toBe(1);
  });
});

describe("editBucket", () => {
  it("splits unedited, light (≤25 %) and heavy edits", () => {
    expect(editBucket(0)).toBe("UNEDITED");
    expect(editBucket(0.25)).toBe("LIGHT");
    expect(editBucket(0.26)).toBe("HEAVY");
  });
});

describe("computeAiQuality", () => {
  const row = (over: Partial<DraftRow>): DraftRow => ({
    status: "OK",
    reason: null,
    text: "one two three four",
    attempts: 1,
    sentText: null,
    ...over,
  });

  it("returns zeros and a null average when there is nothing", () => {
    const q = computeAiQuality([]);
    expect(q.drafts).toBe(0);
    expect(q.avgEditPct).toBeNull();
  });

  it("separates first-try passes, self-corrected retries, blocks and fallbacks", () => {
    const q = computeAiQuality([
      row({}),
      row({ attempts: 2 }),
      row({ status: "BLOCKED", reason: "discount_language", attempts: 2 }),
      row({ status: "BLOCKED", reason: "discount_language", attempts: 2 }),
      row({ status: "FALLBACK", reason: "timeout", attempts: 0 }),
      row({ status: "FALLBACK", reason: null }),
    ]);
    expect(q).toMatchObject({
      drafts: 6,
      okFirstTry: 1,
      okAfterRetry: 1,
      blocked: { discount_language: 2 },
      fallback: { timeout: 1, unknown: 1 },
      sent: 0,
    });
  });

  it("measures edits only on sent drafts, including template drafts", () => {
    const q = computeAiQuality([
      row({ sentText: "one two three four" }), // unedited
      row({ sentText: "one two three FOUR" }), // 25 % → light
      row({ status: "FALLBACK", reason: "timeout", sentText: "totally new reply here now" }), // heavy
      row({}), // not sent
    ]);
    expect(q.sent).toBe(3);
    expect(q.edits).toEqual({ UNEDITED: 1, LIGHT: 1, HEAVY: 1 });
    expect(q.avgEditPct).toBe(42); // (0 + 0.25 + 1) / 3
  });
});
