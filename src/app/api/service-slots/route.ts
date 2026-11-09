import { parseQuery, withApi } from "@/lib/security/guard";
import { ServiceSlotQuerySchema } from "@/server/services/service-slots";
import { getServiceSlots } from "@/server/services/service-slots.repo";

export const dynamic = "force-dynamic";

/** Public. Service slots for one workshop on one IST day, with bays booked / remaining. */
export const GET = withApi(async (req) => {
  const q = parseQuery(req, ServiceSlotQuerySchema);
  return getServiceSlots(q.workshopId, q.date);
});
