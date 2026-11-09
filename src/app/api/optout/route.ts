import { enforceRateLimit, parseBody, withApi } from "@/lib/security/guard";
import { optOut } from "@/server/workflows/public";
import { OptOutSchema } from "@/types/contracts";

/** Public, rate-limited. Always `{ ok: true }` — never reveals whether the phone is known. */
export const POST = withApi(async (req) => {
  enforceRateLimit(req, "optout");
  const { phone } = await parseBody(req, OptOutSchema);
  return optOut(phone);
});
