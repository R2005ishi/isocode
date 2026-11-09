import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { getLeadDetail, updateLead } from "@/server/workflows/leads";
import { LeadPatchSchema } from "@/types/contracts";

export const dynamic = "force-dynamic";

export const GET = withApi<IdCtx>(async (_req, { params }) => {
  const user = await requireRole("CONSULTANT", "ADMIN");
  return getLeadDetail(user, (await params).id);
});

/** Status change and/or re-assign and/or note. */
export const PATCH = withApi<IdCtx>(async (req, { params }) => {
  const user = await requireRole("CONSULTANT", "ADMIN");
  const patch = await parseBody(req, LeadPatchSchema);
  return updateLead(user, (await params).id, patch);
});
