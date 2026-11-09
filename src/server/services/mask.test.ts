import { describe, expect, it } from "vitest";
import { maskPhone, maskRegistration } from "./mask";

describe("maskRegistration", () => {
  it.each([
    ["UP32AB1282", "UP32 •• ••82"],
    ["UP 32 AB 1282", "UP32 •• ••82"],
    ["up-32-ab-1282", "UP32 •• ••82"],
    ["UP32A1", "UP32 •• ••A1"],
    ["DL3CAB12345", "DL3C •• ••45"],
  ])("%s → %s", (input, out) => {
    expect(maskRegistration(input)).toBe(out);
  });

  it("never returns the whole string for short input", () => {
    expect(maskRegistration("AB123")).toBe("•• ••23");
    expect(maskRegistration("A1")).toBe("•• ••");
    expect(maskRegistration("")).toBe("•• ••");
    expect(maskRegistration(null as unknown as string)).toBe("•• ••");
  });

  it("does not leak the middle of the number", () => {
    expect(maskRegistration("UP32AB1282")).not.toContain("AB12");
  });
});

describe("maskPhone", () => {
  it("keeps first 2 and last 3", () => {
    expect(maskPhone("9800000001")).toBe("98•••••001");
    expect(maskPhone("98XXX00001")).toBe("98•••••001");
  });
  it("strips spaces, dashes and the +91 prefix", () => {
    expect(maskPhone("+91 98000-00001")).toBe("98•••••001");
    expect(maskPhone("919800000001")).toBe("98•••••001");
  });
  it("fully masks too-short input", () => {
    expect(maskPhone("12345")).toBe("•••••");
    expect(maskPhone("")).toBe("•••");
    expect(maskPhone(undefined as unknown as string)).toBe("•••");
  });
});
