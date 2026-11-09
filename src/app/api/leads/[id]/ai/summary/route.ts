import { requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { generateSummary } from "@/server/ai";
import { assertLeadAccess } from "@/server/workflows/leads";

export const POST = withApi<IdCtx>(async (_req, { params }) => {
  const user = await requireRole("CONSULTANT", "ADMIN");
  const { id } = await params;
  await assertLeadAccess(user, id);
  return generateSummary(id, user.id);
});
