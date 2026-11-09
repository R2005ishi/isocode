import { parseBody, requireRole, withApi } from "@/lib/security/guard";
import { createUsedCar, listUsedCars } from "@/server/workflows/admin";
import { AdminUsedCarSchema } from "@/types/contracts";

export const dynamic = "force-dynamic";

/** ADMIN sees the full registration; USED_CAR_MANAGER gets only `registrationMasked`. */
export const GET = withApi(async () => {
  const user = await requireRole("ADMIN", "USED_CAR_MANAGER");
  return listUsedCars(user);
});

export const POST = withApi(async (req) => {
  const user = await requireRole("ADMIN", "USED_CAR_MANAGER");
  const input = await parseBody(req, AdminUsedCarSchema);
  return Response.json(await createUsedCar(user, input), { status: 201 });
});
