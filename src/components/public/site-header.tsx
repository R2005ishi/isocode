import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./brand-mark";
import { LocaleToggle } from "./locale-toggle";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const links = [
    { href: "/cars", label: t("newCars") },
    { href: "/used", label: t("usedCars") },
    { href: "/test-drive", label: t("testDrive") },
    { href: "/service", label: t("service") },
    { href: "/trade-in", label: t("tradeIn") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:shadow-lift"
      >
        {t("skipToContent")}
      </a>
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="mr-auto flex items-center gap-2 rounded-md" aria-label={t("brand")}>
          <BrandMark className="size-8" />
          <span className="flex flex-col leading-none">
            <span className="display text-lg font-semibold">{t("brand")}</span>
            <span className="text-[0.6875rem] tracking-wide text-muted-foreground">{t("dealer")}</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <LocaleToggle locale={locale} label={t("language")} />

        <Button asChild className="hidden md:inline-flex">
          <Link href="/test-drive">{t("bookTestDrive")}</Link>
        </Button>

        <MobileNav
          links={links}
          cta={{ href: "/test-drive", label: t("bookTestDrive") }}
          labels={{ open: t("menu"), close: t("closeMenu") }}
        />
      </div>
    </header>
  );
}
