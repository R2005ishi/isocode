import type { Metadata } from "next";
import { requireStaff } from "@/components/staff/require-staff";
import { UsersAdmin } from "@/components/staff/admin/users-admin";

export const metadata: Metadata = { title: "Users & roles" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await requireStaff(["ADMIN"], "/admin/users");
  return <UsersAdmin meId={user.id} />;
}
