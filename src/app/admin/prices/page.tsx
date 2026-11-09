import type { Metadata } from "next";
import { requireStaff } from "@/components/staff/require-staff";
import { PricesAdmin } from "@/components/staff/admin/prices-admin";

export const metadata: Metadata = { title: "City prices" };
export const dynamic = "force-dynamic";

export default async function AdminPricesPage() {
  await requireStaff(["ADMIN"], "/admin/prices");
  return <PricesAdmin />;
}
