import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { deleteModel, getModel, updateModel } from "@/server/workflows/admin";
import { AdminModelPatchSchema } from "@/types/contracts";

export const GET = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return getModel((await params).id);
});

export const PATCH = withApi<IdCtx>(async (req, { params }) => {
  await requireRole("ADMIN");
  const input = await parseBody(req, AdminModelPatchSchema);
  return updateModel((await params).id, input);
});

/** 409 CONFLICT if leads/bookings reference it — deactivate instead. */
export const DELETE = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return deleteModel((await params).id);
});
