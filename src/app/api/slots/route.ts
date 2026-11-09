import { parseQuery, withApi } from "@/lib/security/guard";
import { getSlots } from "@/server/services/slots.repo";
import { SlotQuerySchema } from "@/types/contracts";

export const dynamic = "force-dynamic";

/** Public. Real free slots for one demo car on one IST day. */
export const GET = withApi(async (req) => {
  const q = parseQuery(req, SlotQuerySchema);
  return getSlots(q.showroomId, q.demoCarId, q.date);
});
