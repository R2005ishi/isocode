import { requireRole, withApi } from "@/lib/security/guard";
import { adminLookups } from "@/server/workflows/admin";

export const dynamic = "force-dynamic";

/** Cities, showrooms, models+variants for admin form dropdowns. */
export const GET = withApi(async () => {
  await requireRole("ADMIN");
  return adminLookups();
});
