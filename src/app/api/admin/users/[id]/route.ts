import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { deactivateUser, getUser, updateUser } from "@/server/workflows/admin";
import { AdminUserPatchSchema } from "@/types/contracts";

export const GET = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return getUser((await params).id);
});

/** An admin cannot demote or deactivate themselves (409). */
export const PATCH = withApi<IdCtx>(async (req, { params }) => {
  const actor = await requireRole("ADMIN");
  const input = await parseBody(req, AdminUserPatchSchema);
  return updateUser(actor, (await params).id, input);
});

/** Soft delete: deactivates (users own lead history). */
export const DELETE = withApi<IdCtx>(async (_req, { params }) => {
  const actor = await requireRole("ADMIN");
  return deactivateUser(actor, (await params).id);
});
