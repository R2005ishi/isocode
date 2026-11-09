import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { markContacted } from "@/server/workflows/leads";
import { LeadContactSchema } from "@/types/contracts";

export const POST = withApi<IdCtx>(async (req, { params }) => {
  const user = await requireRole("CONSULTANT", "ADMIN");
  const input = await parseBody(req, LeadContactSchema);
  return markContacted(user, (await params).id, input);
});
