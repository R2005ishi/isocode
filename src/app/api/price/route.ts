import { parseQuery, withApi } from "@/lib/security/guard";
import { getOnRoadPrice } from "@/server/services/pricing.repo";
import { PriceQuerySchema } from "@/types/contracts";

/** Public. Prices come only from the admin price table; no row → 404 PRICE_NOT_PUBLISHED. */
export const GET = withApi(async (req) => {
  const q = parseQuery(req, PriceQuerySchema);
  return getOnRoadPrice(q.variantId, q.citySlug);
});
