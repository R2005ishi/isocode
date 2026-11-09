import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/types/contracts";
import type { StaffUser } from "./staff-header";

/**
 * Defence in depth for staff server components: middleware already gates these routes,
 * but every page re-checks the session and role itself.
 */
export async function requireStaff(roles: Role[], path?: string): Promise<StaffUser> {
  const session = await auth();
  if (!session?.user) {
    redirect(path ? `/login?next=${encodeURIComponent(path)}` : "/login");
  }
  const u = session.user;
  if (!roles.includes(u.role)) redirect("/forbidden");
  return { id: u.id, name: u.name ?? u.email ?? "Staff", email: u.email ?? "", role: u.role };
}
