import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { sendMessage } from "@/server/workflows/leads";
import { SendSchema } from "@/types/contracts";

/** Mock send (MessageLog). 409 OPTED_OUT if the buyer opted out. */
export const POST = withApi<IdCtx>(async (req, { params }) => {
  const user = await requireRole("CONSULTANT", "ADMIN");
  const input = await parseBody(req, SendSchema);
  return Response.json(await sendMessage(user, (await params).id, input), { status: 201 });
});
