import { describe, expect, it } from "vitest";
import {
  AdminBannerPatchSchema,
  AdminBannerSchema,
  AdminOfferPatchSchema,
  AdminOfferSchema,
  bannerIssues,
  bannerStatus,
  isSafeImagePath,
  isSafeInternalHref,
  liveBannerWhere,
  liveOfferWhere,
  offerStatus,
  pickLocale,
  toEndDate,
  toISTDateInput,
  toStartDate,
} from "./cms.schema";

const now = new Date("2026-11-09T06:30:00Z"); // 12:00 IST
const d = (iso: string) => new Date(iso);

describe("isSafeInternalHref", () => {
  it.each(["/", "/test-drive", "/cars/model-h", "/test-drive?model=model-h#top"])("accepts %s", (h) => {
    expect(isSafeInternalHref(h)).toBe(true);
  });
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/foo\\bar",
    "/foo bar",
    "/foo\nbar",
    "cars/model-h",
    "",
  ])("rejects %j", (h) => {
    expect(isSafeInternalHref(h)).toBe(false);
  });
});

describe("isSafeImagePath", () => {
  it("accepts public paths and rejects traversal / external", () => {
    expect(isSafeImagePath("/cars/model-h.svg")).toBe(true);
    expect(isSafeImagePath("/cars/../secret")).toBe(false);
    expect(isSafeImagePath("https://cdn.example/x.png")).toBe(false);
    expect(isSafeImagePath("//cdn.example/x.png")).toBe(false);
  });
});

describe("AdminOfferSchema", () => {
  const base = { title: "Free warranty", body: "Two extra years", validFrom: "2026-11-01", validUntil: "2026-11-30" };

  it("parses a minimal offer with defaults and blank → null", () => {
    const o = AdminOfferSchema.parse({ ...base, titleHi: "", modelId: "" });
    expect(o).toMatchObject({ isActive: true, sortOrder: 0, titleHi: null, modelId: null });
  });
  it("rejects validUntil before validFrom", () => {
    const r = AdminOfferSchema.safeParse({ ...base, validUntil: "2026-10-31" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["validUntil"]);
  });
  it("allows a single-day offer", () => {
    expect(AdminOfferSchema.safeParse({ ...base, validUntil: "2026-11-01" }).success).toBe(true);
  });
  it("rejects invalid dates and short titles", () => {
    expect(AdminOfferSchema.safeParse({ ...base, validFrom: "2026-13-45" }).success).toBe(false);
    expect(AdminOfferSchema.safeParse({ ...base, title: "x" }).success).toBe(false);
  });
  it("patch leaves missing optional fields undefined (not cleared)", () => {
    const p = AdminOfferPatchSchema.parse({ isActive: false });
    expect(p).toEqual({ isActive: false });
    expect(AdminOfferPatchSchema.parse({ modelId: null })).toEqual({ modelId: null });
  });
});

describe("AdminBannerSchema", () => {
  it("parses with HOME placement by default", () => {
    const b = AdminBannerSchema.parse({ title: "Weekend drive", ctaLabel: "Book", ctaHref: "/test-drive", image: "/cars/model-h.svg" });
    expect(b).toMatchObject({ placement: "HOME", isActive: true, ctaHref: "/test-drive" });
    expect(b.startsAt ?? null).toBeNull();
  });
  it("blocks unsafe links and unknown placements", () => {
    for (const ctaHref of ["javascript:alert(1)", "//evil.example", "https://evil.example"]) {
      expect(AdminBannerSchema.safeParse({ title: "Weekend drive", ctaLabel: "Go", ctaHref }).success).toBe(false);
    }
    expect(AdminBannerSchema.safeParse({ title: "Weekend drive", placement: "FOOTER" }).success).toBe(false);
    expect(AdminBannerPatchSchema.safeParse({ ctaHref: "javascript:alert(1)" }).success).toBe(false);
  });
  it("requires label and link together", () => {
    expect(AdminBannerSchema.safeParse({ title: "Weekend drive", ctaLabel: "Go" }).success).toBe(false);
    expect(AdminBannerSchema.safeParse({ title: "Weekend drive", ctaHref: "/used" }).success).toBe(false);
  });
  it("rejects endsAt before startsAt", () => {
    const r = AdminBannerSchema.safeParse({ title: "Weekend drive", startsAt: "2026-11-10", endsAt: "2026-11-09" });
    expect(r.success).toBe(false);
    expect(bannerIssues({ startsAt: d("2026-11-10T00:00:00Z"), endsAt: d("2026-11-01T00:00:00Z") })).toHaveProperty("endsAt");
  });
});

describe("IST date helpers", () => {
  it("expands calendar days to the full IST day", () => {
    expect(toStartDate("2026-11-09").toISOString()).toBe("2026-11-08T18:30:00.000Z");
    expect(toEndDate("2026-11-09").toISOString()).toBe("2026-11-09T18:29:59.999Z");
    expect(toISTDateInput("2026-11-08T18:30:00.000Z")).toBe("2026-11-09");
    expect(toISTDateInput(null)).toBe("");
  });
});

describe("offerStatus", () => {
  const o = { isActive: true, validFrom: d("2026-11-01T00:00:00Z"), validUntil: d("2026-11-30T00:00:00Z") };
  it("is LIVE inside the window", () => expect(offerStatus(o, now)).toBe("LIVE"));
  it("is SCHEDULED before", () => expect(offerStatus({ ...o, validFrom: d("2026-11-10T00:00:00Z") }, now)).toBe("SCHEDULED"));
  it("is EXPIRED after", () => expect(offerStatus({ ...o, validUntil: d("2026-11-09T06:29:59Z") }, now)).toBe("EXPIRED"));
  it("is INACTIVE when switched off, whatever the dates", () => expect(offerStatus({ ...o, isActive: false }, now)).toBe("INACTIVE"));
  it("accepts ISO strings", () =>
    expect(offerStatus({ isActive: true, validFrom: "2026-11-01T00:00:00Z", validUntil: "2026-11-30T00:00:00Z" }, now)).toBe("LIVE"));
  it("treats the last day as live through its end (IST)", () => {
    const lastDay = { isActive: true, validFrom: toStartDate("2026-11-01"), validUntil: toEndDate("2026-11-09") };
    expect(offerStatus(lastDay, d("2026-11-09T18:00:00Z"))).toBe("LIVE"); // 23:30 IST
    expect(offerStatus(lastDay, d("2026-11-09T18:31:00Z"))).toBe("EXPIRED"); // 00:01 IST next day
  });
});

describe("bannerStatus", () => {
  const b = { isActive: true, startsAt: null, endsAt: null };
  it("open-ended active banners are LIVE", () => expect(bannerStatus(b, now)).toBe("LIVE"));
  it("respects start and end when set", () => {
    expect(bannerStatus({ ...b, startsAt: d("2026-11-10T00:00:00Z") }, now)).toBe("SCHEDULED");
    expect(bannerStatus({ ...b, endsAt: d("2026-11-08T00:00:00Z") }, now)).toBe("EXPIRED");
    expect(bannerStatus({ ...b, isActive: false }, now)).toBe("INACTIVE");
  });
});

describe("live query filters", () => {
  it("offers: active, in window, model + global", () => {
    expect(liveOfferWhere(now, "m1")).toEqual({
      isActive: true,
      validFrom: { lte: now },
      validUntil: { gte: now },
      OR: [{ modelId: "m1" }, { modelId: null }],
    });
  });
  it("offers without a model: global only", () => {
    expect(liveOfferWhere(now)).toMatchObject({ modelId: null });
  });
  it("banners: active, placement, open-ended dates allowed", () => {
    expect(liveBannerWhere("HOME", now)).toEqual({
      isActive: true,
      placement: "HOME",
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    });
  });
});

describe("pickLocale", () => {
  it("uses Hindi only when present", () => {
    expect(pickLocale("hi", "Hello", "नमस्ते")).toBe("नमस्ते");
    expect(pickLocale("hi", "Hello", null)).toBe("Hello");
    expect(pickLocale("hi", "Hello", "  ")).toBe("Hello");
    expect(pickLocale("en", "Hello", "नमस्ते")).toBe("Hello");
    expect(pickLocale("hi", null, null)).toBeNull();
  });
});
