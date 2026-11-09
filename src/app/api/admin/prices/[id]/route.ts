import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { deletePrice, updatePrice } from "@/server/workflows/admin";
import { AdminPricePatchSchema } from "@/types/contracts";

export const PATCH = withApi<IdCtx>(async (req, { params }) => {
  const user = await requireRole("ADMIN");
  const input = await parseBody(req, AdminPricePatchSchema);
  return updatePrice(user, (await params).id, input);
});

/** Removing a row makes the site show "Price not yet published" for that city. */
export const DELETE = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return deletePrice((await params).id);
});
