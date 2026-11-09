import type { Metadata } from "next";
import { requireStaff } from "@/components/staff/require-staff";
import { ServiceAdmin } from "@/components/staff/admin/service-admin";

export const metadata: Metadata = { title: "Service bookings" };
export const dynamic = "force-dynamic";

export default async function AdminServicePage() {
  await requireStaff(["ADMIN"], "/admin/service");
  return <ServiceAdmin />;
}
