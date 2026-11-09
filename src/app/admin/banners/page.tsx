import type { Metadata } from "next";
import { requireStaff } from "@/components/staff/require-staff";
import { BannersAdmin } from "@/components/staff/admin/banners-admin";

export const metadata: Metadata = { title: "Banners" };
export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  await requireStaff(["ADMIN"], "/admin/banners");
  return <BannersAdmin />;
}
