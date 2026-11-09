/** Shared fixtures for AI tests (fake data only). */
import type { OnRoadBreakup, Slot } from "@/types/contracts";

export function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead_1",
    name: "Rohan Test",
    source: "WEB",
    status: "NEW",
    locale: "en",
    citySlug: "lucknow",
    message:
      "Looking for an automatic petrol SUV for family use, budget around 12-13 lakh, want to buy before Diwali.",
    showroomId: "sr_1",
    interestVariantId: "var_1",
    showroom: { name: "Gomti Nagar" },
    assignedTo: { name: "Asha Verma" },
    interestModel: { name: "Model H" },
    interestVariant: {
      name: "ZX Automatic Petrol",
      fuel: "PETROL",
      transmission: "AUTOMATIC",
      model: { name: "Model H" },
    },
    interestUsedCar: null,
    activities: [{ type: "CREATED", note: "Lead created from web form" }],
    ...overrides,
  };
}

export const BREAKUP: OnRoadBreakup = {
  variantId: "var_1",
  citySlug: "lucknow",
  cityName: "Lucknow",
  lines: [
    { key: "exShowroom", label: "Ex-showroom", amount: 1_100_000 },
    { key: "roadTax", label: "Road tax", amount: 110_000 },
    { key: "registration", label: "Registration", amount: 2_100 },
    { key: "insurance", label: "Insurance", amount: 35_200 },
    { key: "accessories", label: "Accessories pack", amount: 15_000 },
  ],
  total: 1_262_300,
  validUntil: "2099-12-31T00:00:00.000Z",
  isExpired: false,
  disclaimer: "Prices may change.",
};

/** Three free slots per day, far enough in the future to pass the 2-hour lead time. */
export function slotsForDate(
  _showroomId: string,
  _demoCarId: string,
  date: string,
): Promise<Slot[]> {
  const mk = (hhmm: string): Slot => {
    const start = new Date(`${date}T${hhmm}:00+05:30`);
    const end = new Date(start.getTime() + 45 * 60_000);
    return { start: start.toISOString(), end: end.toISOString(), label: hhmm, available: true };
  };
  return Promise.resolve([mk("10:00"), mk("11:30"), mk("16:00")]);
}
