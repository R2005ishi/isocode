import { Suspense } from "react";
import { requireStaff } from "@/components/staff/require-staff";
import { InboxView } from "@/components/staff/inbox/inbox-view";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await requireStaff(["CONSULTANT", "ADMIN"], "/inbox");
  return (
    <Suspense>
      <InboxView isAdmin={user.role === "ADMIN"} />
    </Suspense>
  );
}
