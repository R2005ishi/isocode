import { parseBody, requireRole, withApi } from "@/lib/security/guard";
import { createModel, listModels } from "@/server/workflows/admin";
import { AdminModelSchema } from "@/types/contracts";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  return listModels();
});

export const POST = withApi(async (req) => {
  await requireRole("ADMIN");
  const input = await parseBody(req, AdminModelSchema);
  return Response.json(await createModel(input), { status: 201 });
});
