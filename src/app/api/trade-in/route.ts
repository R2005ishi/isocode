import { enforceRateLimit, readJson, requireConsent, withApi } from "@/lib/security/guard";
import { createTradeInRequest } from "@/server/workflows/trade-in";
import { TradeInCreateSchema } from "@/server/workflows/trade-in.schema";

export const dynamic = "force-dynamic";

/** Public trade-in request form. Rate-limited, consent required; creates a TRADE_IN lead. */
export const POST = withApi(async (req) => {
  enforceRateLimit(req, "trade-in");
  const body = await readJson(req);
  requireConsent(body);
  const input = TradeInCreateSchema.parse(body);
  return Response.json(await createTradeInRequest(input), { status: 201 });
});
