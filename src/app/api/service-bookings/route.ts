import {
  enforceRateLimit,
  parseQuery,
  readJson,
  requireConsent,
  requireRole,
  withApi,
} from "@/lib/security/guard";
import {
  ServiceBookingCreateSchema,
  ServiceBookingListQuerySchema,
} from "@/server/services/service-slots";
import { bookService, listServiceBookings } from "@/server/workflows/service";

export const dynamic = "force-dynamic";

/** Public, rate-limited, consent required. 409 SLOT_TAKEN when every bay in the slot is booked. */
export const POST = withApi(async (req) => {
  enforceRateLimit(req, "service-bookings");
  const body = await readJson(req);
  requireConsent(body);
  const input = ServiceBookingCreateSchema.parse(body);
  return Response.json(await bookService(input), { status: 201 });
});

/** ADMIN. ?date=YYYY-MM-DD[&workshopId][&status] → bookings + per-slot utilisation. */
export const GET = withApi(async (req) => {
  await requireRole("ADMIN");
  return listServiceBookings(parseQuery(req, ServiceBookingListQuerySchema));
});
