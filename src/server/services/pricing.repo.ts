/**
 * Loads the admin price row for a variant + city and builds the breakup. Server-only.
 */
import { db } from "@/lib/db";
import type { OnRoadBreakup } from "@/types/contracts";
import { computeOnRoad, PriceNotPublishedError } from "./pricing";

export async function getOnRoadPrice(variantId: string, citySlug: string): Promise<OnRoadBreakup> {
  const row = await db.priceComponent.findFirst({
    where: { variantId, city: { slug: citySlug }, variant: { isActive: true } },
    select: {
      roadTaxPct: true,
      registrationFee: true,
      insurance: true,
      accessoriesPack: true,
      otherCharges: true,
      validUntil: true,
      variant: { select: { exShowroomPrice: true } },
      city: { select: { name: true, slug: true } },
    },
  });
  // No row → we never estimate a price.
  if (!row) throw new PriceNotPublishedError();

  return computeOnRoad(
    row.variant.exShowroomPrice,
    {
      roadTaxPct: Number(row.roadTaxPct), // Prisma Decimal → number
      registrationFee: row.registrationFee,
      insurance: row.insurance,
      accessoriesPack: row.accessoriesPack,
      otherCharges: row.otherCharges,
      validUntil: row.validUntil,
    },
    { variantId, citySlug: row.city.slug, cityName: row.city.name },
  );
}
