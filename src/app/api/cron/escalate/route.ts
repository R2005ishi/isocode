import { timingSafeEqual } from "node:crypto";
import { ApiErr } from "@/lib/security/errors";
import { withApi } from "@/lib/security/guard";
import { runEscalations } from "@/server/workflows/escalation";

export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiErr(503, "INTERNAL", "Scheduled escalation is disabled: CRON_SECRET is not set");
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Missed-SLA escalation sweep for an external scheduler (Vercel Cron, cron-job.org, …).
 * Auth: `Authorization: Bearer $CRON_SECRET` (the header Vercel Cron sends).
 */
export const GET = withApi(async (req) => {
  if (!authorised(req)) throw new ApiErr(401, "UNAUTHENTICATED", "Invalid cron secret");
  return runEscalations();
});
