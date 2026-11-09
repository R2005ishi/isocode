import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "./brand-mark";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-secondary/60">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm space-y-3">
          <div className="flex items-center gap-2">
            <BrandMark className="size-7" />
            <span className="display text-lg font-semibold">{nav("brand")}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t("tagline")}</p>
        </div>
        <nav aria-label={t("explore")}>
          <h2 className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {t("explore")}
          </h2>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-primary" href="/cars">{nav("newCars")}</Link></li>
            <li><Link className="hover:text-primary" href="/used">{nav("usedCars")}</Link></li>
            <li><Link className="hover:text-primary" href="/test-drive">{nav("bookTestDrive")}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t("help")}>
          <h2 className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {t("help")}
          </h2>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-primary" href="/privacy">{t("privacy")}</Link></li>
            <li><Link className="hover:text-primary" href="/opt-out">{t("optOut")}</Link></li>
            <li><Link className="text-muted-foreground hover:text-primary" href="/login">{t("staffLogin")}</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-1 py-6 text-xs text-muted-foreground md:flex-row md:justify-between">
          <p>{t("rights", { year })}</p>
          <p>{t("mockNote")}</p>
        </div>
      </div>
    </footer>
  );
}
