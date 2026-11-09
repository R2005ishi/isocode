import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { CityPicker, cityLabel } from "@/components/public/city-picker";
import { EmptyState } from "@/components/public/empty-state";
import { Gallery } from "@/components/public/gallery";
import { JsonLd } from "@/components/public/json-ld";
import { viewKey } from "@/components/public/view-label";
import { formatINR, formatLakh } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { OfferCards } from "@/components/public/offer-cards";
import { getModel, getSelectedCity } from "@/server/queries/public";
import { listLiveOffers } from "@/server/workflows/cms";

type Props = { params: Promise<{ model: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { model: slug } = await params;
  const [locale, city] = await Promise.all([getLocale(), getSelectedCity()]);
  const model = await getModel(slug, city.slug, locale);
  if (!model) notFound();
  const t = await getTranslations("model");
  const price = model.onRoadFrom ?? model.exShowroomFrom;
  const title = `${model.name} ${model.bodyType} — ${t("variantsHeading")}`;
  const description = `${model.description} ${
    price ? t("fromOnRoad", { price: formatLakh(price, locale === "hi" ? "hi" : "en"), city: cityLabel(city, locale) }) : ""
  }`.trim();
  return {
    title,
    description,
    alternates: { canonical: `/cars/${model.slug}` },
    openGraph: { title, description, url: `/cars/${model.slug}`, images: [{ url: model.heroImage }] },
  };
}

export default async function ModelPage({ params }: Props) {
  const { model: slug } = await params;
  const [locale, city] = await Promise.all([getLocale(), getSelectedCity()]);
  const model = await getModel(slug, city.slug, locale);
  if (!model) notFound();

  const [t, tc, tf, ttr, tb, offers] = await Promise.all([
    getTranslations("model"),
    getTranslations("common"),
    getTranslations("fuel"),
    getTranslations("transmission"),
    getTranslations("bodyType"),
    listLiveOffers({ modelId: model.id }),
  ]);
  const cityName = cityLabel(city, locale);
  const lc = locale === "hi" ? "hi" : "en";

  return (
    <div className="container-page pt-6 md:pt-10">
      <Breadcrumbs
        items={[
          { href: "/cars", label: t("breadcrumbCars") },
          { href: `/cars/${model.slug}`, label: model.name },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProductGroup",
          name: `Brand X ${model.name}`,
          description: model.description,
          url: absoluteUrl(`/cars/${model.slug}`),
          image: absoluteUrl(model.heroImage),
          brand: { "@type": "Brand", name: "Brand X" },
          hasVariant: model.variants.map((v) => ({
            "@type": "Car",
            name: `Brand X ${model.name} ${v.name}`,
            url: absoluteUrl(`/cars/${model.slug}/${v.slug}`),
          })),
        }}
      />

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
        <Gallery
          images={model.gallery}
          alts={model.gallery.map((g) => t("imageAlt", { model: model.name, view: t(viewKey(g)) }))}
        />
        <div className="space-y-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            {tb.has(model.bodyType) ? tb(model.bodyType) : model.bodyType}
          </p>
          <h1 className="display text-4xl font-semibold md:text-5xl">{model.name}</h1>
          <p className="text-lg text-muted-foreground">{model.description}</p>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            {model.onRoadFrom !== null ? (
              <>
                <p className="text-sm text-muted-foreground">{t("onRoadIn", { city: cityName })}</p>
                <p className="tabular display text-3xl font-semibold">
                  {tc("from")} {formatLakh(model.onRoadFrom, lc)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("priceNotPublishedShort", { city: cityName })}</p>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="flex-1">
                <Link href={`/test-drive?model=${model.slug}`}>{tc("bookTestDrive")}</Link>
              </Button>
              <CityPicker className="justify-center" />
            </div>
          </div>
          <OfferCards offers={offers} locale={locale} modelName={model.name} />
        </div>
      </div>

      <section className="mt-16" aria-labelledby="variants-h">
        <h2 id="variants-h" className="display mb-6 text-3xl font-semibold">
          {t("variantsHeading")}
        </h2>
        {model.variants.length === 0 ? (
          <EmptyState title={t("noVariants")} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {model.variants.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/cars/${model.slug}/${v.slug}`}
                  className="group flex items-center gap-4 p-5 transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent md:p-6"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-lg font-semibold">
                      {model.name} {v.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {tf(v.fuel)} · {ttr(v.transmission)} · {t("fromExShowroom", { price: formatINR(v.exShowroomPrice) })}
                    </p>
                  </div>
                  <div className="text-right">
                    {v.onRoadFrom !== null ? (
                      <>
                        <p className="text-xs text-muted-foreground">{t("onRoadIn", { city: cityName })}</p>
                        <p className="tabular text-lg font-semibold">{formatINR(v.onRoadFrom)}</p>
                      </>
                    ) : (
                      <p className="max-w-40 text-xs text-muted-foreground">
                        {t("priceNotPublishedShort", { city: cityName })}
                      </p>
                    )}
                  </div>
                  <ChevronRightIcon
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
