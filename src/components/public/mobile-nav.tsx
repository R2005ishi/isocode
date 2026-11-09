"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type NavLink = { href: string; label: string };

export function MobileNav({
  links,
  cta,
  labels,
}: {
  links: NavLink[];
  cta: NavLink;
  labels: { open: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
      </Button>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="absolute inset-x-0 top-16 border-b border-border bg-background shadow-lift"
        >
          <ul className="container-page flex flex-col py-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={pathname.startsWith(l.href) ? "page" : undefined}
                  className="block rounded-md px-2 py-3 text-base font-medium hover:bg-accent aria-[current=page]:text-primary"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-2 pb-2">
              <Button asChild size="lg" className="w-full">
                <Link href={cta.href}>{cta.label}</Link>
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
