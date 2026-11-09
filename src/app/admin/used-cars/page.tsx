import type { Metadata } from "next";
import { requireStaff } from "@/components/staff/require-staff";
import { UsedCarsAdmin } from "@/components/staff/admin/used-cars-admin";

export const metadata: Metadata = { title: "Used stock" };
export const dynamic = "force-dynamic";

export default async function AdminUsedCarsPage() {
  const user = await requireStaff(["ADMIN", "USED_CAR_MANAGER"], "/admin/used-cars");
  return <UsedCarsAdmin isAdmin={user.role === "ADMIN"} isManager={user.role === "USED_CAR_MANAGER"} />;
}
