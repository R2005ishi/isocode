import { requireRole, withApi } from "@/lib/security/guard";
import { listConsultants } from "@/server/workflows/leads";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  await requireRole("CONSULTANT", "ADMIN");
  return listConsultants();
});
