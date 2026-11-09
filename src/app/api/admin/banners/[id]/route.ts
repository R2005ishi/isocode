import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { deleteBanner, getBanner, updateBanner } from "@/server/workflows/cms";
import { AdminBannerPatchSchema } from "@/server/workflows/cms.schema";

export const GET = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return getBanner((await params).id);
});

export const PATCH = withApi<IdCtx>(async (req, { params }) => {
  await requireRole("ADMIN");
  const input = await parseBody(req, AdminBannerPatchSchema);
  return updateBanner((await params).id, input);
});

export const DELETE = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("ADMIN");
  return deleteBanner((await params).id);
});
