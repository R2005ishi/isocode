import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/login/actions";
import type { Role } from "@/types/contracts";
import { ROLE_LABEL } from "./labels";
import { NavLink } from "./nav-link";

export type StaffUser = { id: string; name: string; email: string; role: Role };

function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => /^[\p{L}]/u.test(w))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Top bar for all staff screens: brand, role-aware nav, user + sign-out. */
export function StaffHeader({ user }: { user: StaffUser }) {
  const links: { href: string; label: string }[] = [];
  if (user.role === "CONSULTANT" || user.role === "ADMIN") links.push({ href: "/inbox", label: "Lead inbox" });
  if (user.role === "ADMIN") links.push({ href: "/admin", label: "Admin" });
  if (user.role === "USED_CAR_MANAGER") links.push({ href: "/admin/used-cars", label: "Used stock" });

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
            BX
          </span>
          <span className="hidden sm:inline">Brand X Lucknow</span>
          <span className="hidden rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase md:inline">
            Staff
          </span>
        </Link>
        <nav aria-label="Staff" className="ml-1 flex items-center gap-0.5 sm:ml-4">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
          </div>
          <span
            className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold"
            title={`${user.name} · ${ROLE_LABEL[user.role]}`}
            aria-hidden
          >
            {initials(user.name)}
          </span>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm" className="h-8" aria-label="Sign out">
              <LogOutIcon />
              <span className="hidden md:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
