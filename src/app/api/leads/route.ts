import {
  enforceRateLimit,
  parseQuery,
  readJson,
  requireConsent,
  requireRole,
  withApi,
} from "@/lib/security/guard";
import { listLeads } from "@/server/workflows/leads";
import { createEnquiry } from "@/server/workflows/public";
import { LeadCreateSchema, LeadListQuerySchema } from "@/types/contracts";

export const dynamic = "force-dynamic";

/** Staff inbox: consultants get their own leads; admins may ask for scope=all. */
export const GET = withApi(async (req) => {
  const user = await requireRole("CONSULTANT", "ADMIN");
  return listLeads(user, parseQuery(req, LeadListQuerySchema));
});

/** Public enquiry form. Rate-limited, consent required. */
export const POST = withApi(async (req) => {
  enforceRateLimit(req, "leads");
  const body = await readJson(req);
  requireConsent(body);
  const input = LeadCreateSchema.parse(body);
  return Response.json(await createEnquiry(input), { status: 201 });
});
