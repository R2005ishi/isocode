import { z } from "zod";
import { parseBody, parseQuery, requireRole, withApi } from "@/lib/security/guard";
import { listPrices, upsertPrice } from "@/server/workflows/admin";
import { AdminPriceSchema } from "@/types/contracts";

export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  await requireRole("ADMIN");
  const q = parseQuery(
    req,
    z.object({ variantId: z.string().min(1).optional(), cityId: z.string().min(1).optional() }),
  );
  return listPrices(q);
});

/** Upsert by (variantId, cityId). Records who saved it. */
export const POST = withApi(async (req) => {
  const user = await requireRole("ADMIN");
  const input = await parseBody(req, AdminPriceSchema);
  return upsertPrice(user, input);
});
