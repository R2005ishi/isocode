import Link from "next/link";
import { ArrowRightIcon, BadgeIndianRupeeIcon, CalendarCheckIcon, PhoneCallIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CarImage } from "@/components/public/car-image";
import { CityPicker, cityLabel } from "@/components/public/city-picker";
import { EmptyState } from "@/components/public/empty-state";
import { ModelCard } from "@/components/public/model-card";
import { SectionHeading } from "@/components/public/section-heading";
import { UsedCarCard } from "@/components/public/used-car-card";
import { PromoBanners } from "@/components/public/promo-banner";
import { getSelectedCity, listModels, listUsedCars } from "@/server/queries/public";
import { listLiveBanners } from "@/server/workflows/cms";

export default async function HomePage() {
  const [t, locale, city] = await Promise.all([getTranslations("home"), getLocale(), getSelectedCity()]);
  const [models, used, banners] = await Promise.all([
    listModels(city.slug, locale),
    listUsedCars({ status: "AVAILABLE" }),
    listLiveBanners("HOME"),
  ]);
  const cityName = cityLabel(city, locale);
  const tc = await getTranslations("common");

  const trust = [
    { icon: BadgeIndianRupeeIcon, title: t("trust1Title"), body: t("trust1Body") },
    { icon: CalendarCheckIcon, title: t("trust2Title"), body: t("trust2Body") },
    { icon: PhoneCallIcon, title: t("trust3Title"), body: t("trust3Body") },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(60%_80%_at_70%_100%,var(--primary-soft),transparent_70%)]"
        />
        <div className="container-page relative grid items-center gap-8 pt-10 pb-12 md:grid-cols-[1fr_1.15fr] md:pt-20 md:pb-24">
          <div className="space-y-6">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{t("eyebrow")}</p>
            <h1 className="display text-[2.5rem] font-semibold md:text-[3.5rem]">{t("title")}</h1>
            <p className="max-w-md text-lg text-muted-foreground">{t("subtitle")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/test-drive">{t("ctaTestDrive")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#models">
                  {t("ctaModels")} <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="-mx-4 md:mx-0">
            <CarImage
              src="/cars/model-h.svg"
              alt={t("heroAlt")}
              priority
              sizes="(min-width: 768px) 55vw, 100vw"
            />
          </div>
        </div>
      </section>

      {/* Admin-managed promo banners (renders nothing when none are live) */}
      <PromoBanners banners={banners} locale={locale} />

      {/* Trust row */}
      <section className="border-y border-border bg-card">
        <ul className="container-page grid gap-6 py-8 md:grid-cols-3">
          {trust.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-heading text-base font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* New models */}
      <section id="models" className="container-page scroll-mt-20 py-16 md:py-24">
        <SectionHeading
          title={t("modelsHeading")}
          subtitle={t("modelsSub", { city: cityName })}
          action={<CityPicker />}
        />
        {models.length === 0 ? (
          <EmptyState title={t("modelsEmpty")} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {models.map((m) => (
              <ModelCard key={m.id} model={m} cityName={cityName} />
            ))}
          </div>
        )}
      </section>

      {/* Certified used */}
      <section className="-mb-16 bg-secondary/50 py-16 md:-mb-24 md:py-24">
        <div className="container-page">
          <SectionHeading
            title={t("usedHeading")}
            subtitle={t("usedSub")}
            action={
              <Button asChild variant="outline">
                <Link href="/used">
                  {tc("viewAll")} <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            }
          />
          {used.length === 0 ? (
            <EmptyState title={t("usedEmpty")} />
          ) : (
            <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
              {used.slice(0, 4).map((c) => (
                <li key={c.id} className="w-[78%] shrink-0 snap-start sm:w-[45%] md:w-auto">
                  <UsedCarCard car={c} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
