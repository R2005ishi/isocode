import { parseBody, requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { ServiceBookingStatusPatchSchema } from "@/server/services/service-slots";
import { updateServiceBookingStatus } from "@/server/workflows/service";

/** ADMIN. { status: "CANCELLED" | "COMPLETED" } — only CONFIRMED bookings can change (409 otherwise). */
export const PATCH = withApi<IdCtx>(async (req, { params }) => {
  await requireRole("ADMIN");
  const { status } = await parseBody(req, ServiceBookingStatusPatchSchema);
  return updateServiceBookingStatus((await params).id, status);
});
