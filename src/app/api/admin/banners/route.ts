import { parseBody, requireRole, withApi } from "@/lib/security/guard";
import { createBanner, listBanners } from "@/server/workflows/cms";
import { AdminBannerSchema } from "@/server/workflows/cms.schema";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  return listBanners();
});

export const POST = withApi(async (req) => {
  await requireRole("ADMIN");
  const input = await parseBody(req, AdminBannerSchema);
  return Response.json(await createBanner(input), { status: 201 });
});
