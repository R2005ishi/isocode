import { enforceRateLimit, readJson, requireConsent, withApi } from "@/lib/security/guard";
import { bookTestDrive } from "@/server/workflows/public";
import { TestDriveCreateSchema } from "@/types/contracts";

/** Public, rate-limited, consent required. */
export const POST = withApi(async (req) => {
  enforceRateLimit(req, "test-drives");
  const body = await readJson(req);
  requireConsent(body);
  const input = TestDriveCreateSchema.parse(body);
  return Response.json(await bookTestDrive(input), { status: 201 });
});
