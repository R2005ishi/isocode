"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  exact = false,
  children,
  variant = "top",
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
  variant?: "top" | "tab";
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  if (variant === "tab") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative inline-flex h-10 shrink-0 items-center px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
          active &&
            "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground",
        )}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
