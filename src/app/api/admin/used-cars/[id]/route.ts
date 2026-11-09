import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { deleteUsedCar, getUsedCar, updateUsedCar } from "@/server/workflows/admin";
import { AdminUsedCarPatchSchema } from "@/types/contracts";

export const GET = withApi<IdCtx>(async (_req, { params }) => {
  const user = await requireRole("ADMIN", "USED_CAR_MANAGER");
  return getUsedCar(user, (await params).id);
});

export const PATCH = withApi<IdCtx>(async (req, { params }) => {
  const user = await requireRole("ADMIN", "USED_CAR_MANAGER");
  const input = await parseBody(req, AdminUsedCarPatchSchema);
  return updateUsedCar(user, (await params).id, input);
});

export const DELETE = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN", "USED_CAR_MANAGER");
  return deleteUsedCar((await params).id);
});
