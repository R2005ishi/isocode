import { describe, expect, it } from "vitest";
import { makeReference, REFERENCE_ALPHABET } from "./ids";

describe("makeReference", () => {
  it("formats PREFIX-XXXXX from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      expect(makeReference("TD")).toMatch(/^TD-[2-9A-HJ-NP-Z]{5}$/);
      expect(makeReference("EN")).toMatch(/^EN-[2-9A-HJ-NP-Z]{5}$/);
    }
  });
  it("excludes 0, O, 1 and I", () => {
    expect(REFERENCE_ALPHABET).not.toMatch(/[0O1I]/);
  });
  it("is effectively unique", () => {
    const set = new Set(Array.from({ length: 500 }, () => makeReference("TD")));
    expect(set.size).toBeGreaterThan(495);
  });
});
