import { parseBody, requireRole, withApi } from "@/lib/security/guard";
import { createOffer, listOffers } from "@/server/workflows/cms";
import { AdminOfferSchema } from "@/server/workflows/cms.schema";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  return listOffers();
});

export const POST = withApi(async (req) => {
  await requireRole("ADMIN");
  const input = await parseBody(req, AdminOfferSchema);
  return Response.json(await createOffer(input), { status: 201 });
});
