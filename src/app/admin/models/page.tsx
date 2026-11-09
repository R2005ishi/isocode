import type { Metadata } from "next";
import { requireStaff } from "@/components/staff/require-staff";
import { ModelsAdmin } from "@/components/staff/admin/models-admin";

export const metadata: Metadata = { title: "Models & variants" };
export const dynamic = "force-dynamic";

export default async function AdminModelsPage() {
  await requireStaff(["ADMIN"], "/admin/models");
  return <ModelsAdmin />;
}
