import type { Metadata } from "next";
import { requireStaff } from "@/components/staff/require-staff";
import { OffersAdmin } from "@/components/staff/admin/offers-admin";

export const metadata: Metadata = { title: "Offers" };
export const dynamic = "force-dynamic";

export default async function AdminOffersPage() {
  await requireStaff(["ADMIN"], "/admin/offers");
  return <OffersAdmin />;
}
