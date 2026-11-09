import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { generateDraft } from "@/server/ai";
import { assertLeadAccess } from "@/server/workflows/leads";
import { AiDraftRequestSchema } from "@/types/contracts";

export const POST = withApi<IdCtx>(async (req, { params }) => {
  const user = await requireRole("CONSULTANT", "ADMIN");
  const { id } = await params;
  const input = await parseBody(req, AiDraftRequestSchema);
  await assertLeadAccess(user, id);
  return generateDraft(id, user.id, input.locale);
});
