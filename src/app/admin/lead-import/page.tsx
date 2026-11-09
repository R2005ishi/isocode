import type { Metadata } from "next";
import { requireStaff } from "@/components/staff/require-staff";
import { LeadImportAdmin } from "@/components/staff/admin/lead-import-admin";

export const metadata: Metadata = { title: "Import portal leads" };
export const dynamic = "force-dynamic";

export default async function AdminLeadImportPage() {
  await requireStaff(["ADMIN"], "/admin/lead-import");
  return <LeadImportAdmin />;
}
