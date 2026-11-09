import { z } from "zod";
import { parseBody, parseQuery, requireRole, withApi } from "@/lib/security/guard";
import { createVariant, listVariants } from "@/server/workflows/admin";
import { AdminVariantSchema } from "@/types/contracts";

export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  await requireRole("ADMIN");
  const q = parseQuery(req, z.object({ modelId: z.string().min(1).optional() }));
  return listVariants(q.modelId);
});

export const POST = withApi(async (req) => {
  await requireRole("ADMIN");
  const input = await parseBody(req, AdminVariantSchema);
  return Response.json(await createVariant(input), { status: 201 });
});
