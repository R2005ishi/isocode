import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CarImage } from "@/components/public/car-image";
import { cn } from "@/lib/utils";
import { isSafeImagePath, isSafeInternalHref, pickLocale } from "@/server/workflows/cms.schema";
import type { LiveBanner } from "@/server/workflows/cms";

/**
 * Live home-page banners as a stacked strip (one) or a swipeable, scroll-snapping row (several) —
 * CSS only, no JS carousel. Renders nothing when there are no live banners.
 */
export async function PromoBanners({ banners, locale }: { banners: LiveBanner[]; locale: string }) {
  if (banners.length === 0) return null;
  const t = await getTranslations("offers");
  const many = banners.length > 1;

  return (
    <section aria-label={t("bannersLabel")} className="container-page pb-10 md:pb-16">
      <ul
        className={cn(
          many &&
            "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0",
        )}
      >
        {banners.map((b) => (
          <li key={b.id} className={cn(many && "w-[88%] shrink-0 snap-start sm:w-[70%] md:w-auto")}>
            <PromoBanner banner={b} locale={locale} compact={many} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PromoBanner({ banner: b, locale, compact }: { banner: LiveBanner; locale: string; compact: boolean }) {
  const title = pickLocale(locale, b.title, b.titleHi);
  const subtitle = pickLocale(locale, b.subtitle, b.subtitleHi);
  const cta = pickLocale(locale, b.ctaLabel, b.ctaLabelHi);
  // Defence in depth: the admin API already validates these.
  const href = b.ctaHref && isSafeInternalHref(b.ctaHref) ? b.ctaHref : null;
  const image = b.image && isSafeImagePath(b.image) ? b.image : null;

  return (
    <article
      className={cn(
        "relative grid h-full items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft",
        !compact && "md:grid-cols-[1.2fr_1fr] md:p-10",
        compact && image && "grid-cols-[1fr_7rem] sm:grid-cols-[1fr_9rem]",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_100%_100%,var(--primary-soft),transparent_70%)]"
      />
      <div className="relative space-y-3">
        <h2 className={cn("display font-semibold", compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl")}>{title}</h2>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        {href && cta && (
          <Button asChild variant={compact ? "outline" : "default"} className="mt-1">
            <Link href={href}>
              {cta} <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
      {image && (
        <div className="relative">
          <CarImage src={image} alt="" sizes={compact ? "160px" : "(min-width: 768px) 40vw, 100vw"} />
        </div>
      )}
    </article>
  );
}
