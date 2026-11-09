import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { deleteVariant, getVariant, updateVariant } from "@/server/workflows/admin";
import { AdminVariantPatchSchema } from "@/types/contracts";

export const GET = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return getVariant((await params).id);
});

export const PATCH = withApi<IdCtx>(async (req, { params }) => {
  await requireRole("ADMIN");
  const input = await parseBody(req, AdminVariantPatchSchema);
  return updateVariant((await params).id, input);
});

export const DELETE = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return deleteVariant((await params).id);
});
