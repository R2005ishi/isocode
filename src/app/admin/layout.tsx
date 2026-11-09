import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/query-provider";
import { StaffHeader } from "@/components/staff/staff-header";
import { requireStaff } from "@/components/staff/require-staff";
import { NavLink } from "@/components/staff/nav-link";

export const metadata: Metadata = {
  title: { default: "Admin · Brand X staff", template: "%s · Brand X admin" },
  robots: { index: false, follow: false },
};

const ADMIN_TABS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/models", label: "Models & variants" },
  { href: "/admin/prices", label: "City prices" },
  { href: "/admin/used-cars", label: "Used stock" },
  { href: "/admin/users", label: "Users & roles" },
  { href: "/admin/lead-import", label: "Import leads" },
  { href: "/admin/service", label: "Service" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/banners", label: "Banners" },
  { href: "/admin/ai", label: "AI quality" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff(["ADMIN", "USED_CAR_MANAGER"], "/admin");
  // The used-car manager only works on used stock — hide every other tab.
  const tabs = user.role === "ADMIN" ? ADMIN_TABS : [];

  return (
    <QueryProvider>
      <div className="min-h-dvh bg-muted/30">
        <StaffHeader user={user} />
        {tabs.length > 0 && (
          <div className="border-b bg-background">
            <nav
              aria-label="Admin sections"
              className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 sm:px-4 [scrollbar-width:none]"
            >
              {tabs.map((t) => (
                <NavLink key={t.href} href={t.href} exact={t.exact} variant="tab">
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </QueryProvider>
  );
}
