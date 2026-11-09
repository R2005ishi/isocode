import { notFound } from "@/lib/security/errors";
import { requireRole, withApi, type IdCtx } from "@/lib/security/guard";
import { db } from "@/lib/db";
import { priceBand } from "@/server/ai";

/** Manager-only price suggestion from past sales (never shown to buyers). */
export const GET = withApi<IdCtx>(async (_req, { params }) => {
  await requireRole("USED_CAR_MANAGER", "ADMIN");
  const car = await db.usedCar.findUnique({
    where: { id: (await params).id },
    select: { modelName: true, year: true, km: true },
  });
  if (!car) throw notFound("Used car not found");
  return priceBand(car.modelName, car.year, car.km);
});
