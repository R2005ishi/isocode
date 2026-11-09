import { parseBody, requireRole, withApi } from "@/lib/security/guard";
import { createUser, listUsers } from "@/server/workflows/admin";
import { AdminUserSchema } from "@/types/contracts";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  return listUsers();
});

export const POST = withApi(async (req) => {
  await requireRole("ADMIN");
  const input = await parseBody(req, AdminUserSchema);
  return Response.json(await createUser(input), { status: 201 });
});
