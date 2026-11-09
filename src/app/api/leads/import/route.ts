import { ApiErr, parseBody, requireRole, withApi } from "@/lib/security/guard";
import { IMPORT_MAX_BYTES, LeadImportRequestSchema } from "@/server/services/lead-import";
import { importPortalLeads, listLeadImports } from "@/server/workflows/lead-import";

export const dynamic = "force-dynamic";
// Up to 2,000 rows, each in its own small transaction.
export const maxDuration = 60;

/** JSON-escaping can inflate the CSV text; allow headroom over the 1 MB CSV limit. */
const MAX_BODY_BYTES = IMPORT_MAX_BYTES * 3;

/** Past portal imports, newest first. ADMIN only. */
export const GET = withApi(async () => {
  await requireRole("ADMIN");
  return listLeadImports();
});

/**
 * Body: `{ fileName, portalName, csvText, defaultShowroomId?, dryRun? }` (the file is read as text
 * client-side). `dryRun: true` returns the preview without writing anything. ADMIN only.
 */
export const POST = withApi(async (req) => {
  const user = await requireRole("ADMIN");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) {
    throw new ApiErr(400, "VALIDATION", "File is larger than 1 MB", {
      csvText: "File is larger than 1 MB",
    });
  }
  const input = await parseBody(req, LeadImportRequestSchema);
  const result = await importPortalLeads(user, input);
  return Response.json(result, { status: input.dryRun ? 200 : 201 });
});
