import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { deleteOffer, getOffer, updateOffer } from "@/server/workflows/cms";
import { AdminOfferPatchSchema } from "@/server/workflows/cms.schema";

export const GET = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return getOffer((await params).id);
});

export const PATCH = withApi<IdCtx>(async (req, { params }) => {
  await requireRole("ADMIN");
  const input = await parseBody(req, AdminOfferPatchSchema);
  return updateOffer((await params).id, input);
});

export const DELETE = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return deleteOffer((await params).id);
});
