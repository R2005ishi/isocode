import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/query-provider";
import { StaffHeader } from "@/components/staff/staff-header";
import { requireStaff } from "@/components/staff/require-staff";

export const metadata: Metadata = {
  title: "Lead inbox · Brand X staff",
  robots: { index: false, follow: false },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff(["CONSULTANT", "ADMIN"], "/inbox");
  return (
    <QueryProvider>
      <div className="min-h-dvh bg-muted/30">
        <StaffHeader user={user} />
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </QueryProvider>
  );
}
