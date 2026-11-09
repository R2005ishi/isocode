import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  priceComponent: { findFirst: vi.fn() },
  showroom: { findUnique: vi.fn() },
  demoCar: { findFirst: vi.fn() },
  testDriveBooking: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

import { PriceNotPublishedError } from "./pricing";
import { getOnRoadPrice } from "./pricing.repo";
import { getSlots } from "./slots.repo";
import { istDateString } from "./slots";

beforeEach(() => vi.clearAllMocks());

describe("getOnRoadPrice", () => {
  it("throws PriceNotPublishedError when no row exists", async () => {
    db.priceComponent.findFirst.mockResolvedValue(null);
    await expect(getOnRoadPrice("v1", "kanpur")).rejects.toBeInstanceOf(PriceNotPublishedError);
  });

  it("converts Decimal road tax and builds the breakup", async () => {
    db.priceComponent.findFirst.mockResolvedValue({
      roadTaxPct: { toString: () => "10.00", valueOf: () => 10 }, // Decimal-like
      registrationFee: 2100,
      insurance: 40_000,
      accessoriesPack: 15_000,
      otherCharges: 0,
      validUntil: new Date(Date.now() + 86_400_000),
      variant: { exShowroomPrice: 1_000_000 },
      city: { name: "Lucknow", slug: "lucknow" },
    });
    const r = await getOnRoadPrice("v1", "lucknow");
    expect(r.cityName).toBe("Lucknow");
    expect(r.lines[1]!.amount).toBe(100_000);
    expect(r.total).toBe(1_157_100);
    expect(r.isExpired).toBe(false);
    expect(db.priceComponent.findFirst.mock.calls[0]![0].where).toEqual({
      variantId: "v1",
      city: { slug: "lucknow" },
      variant: { isActive: true },
    });
  });
});

describe("getSlots", () => {
  const tomorrow = istDateString(new Date(Date.now() + 86_400_000));

  it("returns [] for an invalid date without querying", async () => {
    expect(await getSlots("s1", "d1", "bad")).toEqual([]);
    expect(db.showroom.findUnique).not.toHaveBeenCalled();
  });

  it("returns [] when the demo car is not at that showroom / inactive", async () => {
    db.showroom.findUnique.mockResolvedValue({ openHour: 10, closeHour: 19 });
    db.demoCar.findFirst.mockResolvedValue(null);
    expect(await getSlots("s1", "d1", tomorrow)).toEqual([]);
    expect(db.demoCar.findFirst.mock.calls[0]![0].where).toEqual({
      id: "d1",
      showroomId: "s1",
      isActive: true,
    });
  });

  it("marks confirmed bookings unavailable", async () => {
    db.showroom.findUnique.mockResolvedValue({ openHour: 10, closeHour: 19 });
    db.demoCar.findFirst.mockResolvedValue({ id: "d1" });
    const booked = new Date(`${tomorrow}T10:45:00.000+05:30`);
    db.testDriveBooking.findMany.mockResolvedValue([{ slotStart: booked }]);
    const slots = await getSlots("s1", "d1", tomorrow);
    expect(slots).toHaveLength(12);
    expect(slots.filter((s) => !s.available).map((s) => s.label)).toEqual(["10:45"]);
    const where = db.testDriveBooking.findMany.mock.calls[0]![0].where;
    expect(where.status).toBe("CONFIRMED");
    expect(where.slotStart.lt.getTime() - where.slotStart.gte.getTime()).toBe(86_400_000);
  });
});
