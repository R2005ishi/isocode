import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheckIcon, CircleAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { CityPicker, cityLabel } from "@/components/public/city-picker";
import { ColourSwatches } from "@/components/public/colour-swatches";
import { EmiCalculator } from "@/components/public/emi-calculator";
import { EnquiryDialog } from "@/components/public/enquiry-dialog";
import { Gallery } from "@/components/public/gallery";
import { JsonLd } from "@/components/public/json-ld";
import { PriceBreakup } from "@/components/public/price-breakup";
import { viewKey } from "@/components/public/view-label";
import { formatDateIST, formatINR, formatLakh } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { OfferCards } from "@/components/public/offer-cards";
import { getModel, getSelectedCity } from "@/server/queries/public";
import { listLiveOffers } from "@/server/workflows/cms";
import { PriceNotPublishedError } from "@/server/services/pricing";
import { getOnRoadPrice } from "@/server/services/pricing.repo";
import type { OnRoadBreakup } from "@/types/contracts";

type Props = { params: Promise<{ model: string; variant: string }> };

async function load(modelSlug: string, variantSlug: string) {
  const [locale, city] = await Promise.all([getLocale(), getSelectedCity()]);
  const model = await getModel(modelSlug, city.slug, locale);
  const variant = model?.variants.find((v) => v.slug === variantSlug);
  if (!model || !variant) return null;
  return { locale, city, model, variant };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { model: m, variant: v } = await params;
  const data = await load(m, v);
  if (!data) notFound();
  const { model, variant, city, locale } = data;
  const [t, tf, ttr] = await Promise.all([
    getTranslations("model"),
    getTranslations("fuel"),
    getTranslations("transmission"),
  ]);
  const name = `${model.name} ${variant.name}`;
  const cityName = cityLabel(city, locale);
  const priceText =
    variant.onRoadFrom !== null
      ? t("fromOnRoad", { price: formatINR(variant.onRoadFrom), city: cityName })
      : t("fromExShowroom", { price: formatINR(variant.exShowroomPrice) });
  const title = `${name} — ${priceText}`;
  const description = `${name}: ${tf(variant.fuel)}, ${ttr(variant.transmission)}. ${priceText}. ${model.description}`;
  const url = `/cars/${model.slug}/${variant.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title, description, url, images: [{ url: model.heroImage }] },
  };
}

export default async function VariantPage({ params }: Props) {
  const { model: m, variant: v } = await params;
  const data = await load(m, v);
  if (!data) notFound();
  const { model, variant, city, locale } = data;

  let breakup: OnRoadBreakup | null = null;
  try {
    breakup = await getOnRoadPrice(variant.id, city.slug);
  } catch (e) {
    if (!(e instanceof PriceNotPublishedError)) throw e;
  }

  const tti = await getTranslations("tradeIn");
  const [t, tv, tp, tc, tf, ttr, temi, offers] = await Promise.all([
    getTranslations("model"),
    getTranslations("variant"),
    getTranslations("price"),
    getTranslations("common"),
    getTranslations("fuel"),
    getTranslations("transmission"),
    getTranslations("emi"),
    listLiveOffers({ modelId: model.id }),
  ]);
  const cityName = cityLabel(city, locale);
  const name = `${model.name} ${variant.name}`;
  const url = `/cars/${model.slug}/${variant.slug}`;
  const testDriveHref = `/test-drive?variant=${encodeURIComponent(variant.id)}`;
  const enquiry = {
    interestModelId: model.id,
    interestVariantId: variant.id,
    citySlug: city.slug,
  };

  const specRows: [string, string][] = [
    [tv("spec.fuel"), tf(variant.fuel)],
    [tv("spec.transmission"), ttr(variant.transmission)],
    ...Object.entries(variant.specs).map(([k, val]): [string, string] => [
      tv.has(`spec.${k}`) ? tv(`spec.${k}` as "spec.engine") : humanize(k),
      String(val),
    ]),
  ];
  const siblings = model.variants.filter((x) => x.id !== variant.id);

  const ctas = (
    <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
      <Button asChild size="lg" className="flex-1">
        <Link href={testDriveHref}>
          <CalendarCheckIcon aria-hidden="true" /> {tc("bookTestDrive")}
        </Link>
      </Button>
      <EnquiryDialog
        itemLabel={name}
        interest={enquiry}
        triggerLabel={tc("enquire")}
        triggerClassName="flex-1"
      />
    </div>
  );
  const tradeInLink = (
    <Link
      href={`/trade-in?variant=${encodeURIComponent(variant.id)}`}
      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {tti("cta")} →
    </Link>
  );

  return (
    <div className="container-page pt-6 md:pt-10">
      <Breadcrumbs
        items={[
          { href: "/cars", label: t("breadcrumbCars") },
          { href: `/cars/${model.slug}`, label: model.name },
          { href: url, label: variant.name },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Car",
          name: `Brand X ${name}`,
          description: model.description,
          url: absoluteUrl(url),
          image: model.gallery.map((g) => absoluteUrl(g)),
          brand: { "@type": "Brand", name: "Brand X" },
          model: model.name,
          vehicleConfiguration: variant.name,
          bodyType: model.bodyType,
          fuelType: variant.fuel,
          vehicleTransmission: variant.transmission,
          itemCondition: "https://schema.org/NewCondition",
          ...(variant.code ? { sku: variant.code } : {}),
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            // On-road total from the admin table when published, otherwise the ex-showroom price.
            price: breakup?.total ?? variant.exShowroomPrice,
            ...(breakup ? { priceValidUntil: breakup.validUntil.slice(0, 10) } : {}),
            availability: "https://schema.org/InStock",
            areaServed: city.name,
            url: absoluteUrl(url),
            seller: { "@type": "AutoDealer", name: "Company A" },
          },
        }}
      />

      {/* Title + (on phones) price and the next step, above the fold */}
      <header className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{tf(variant.fuel)}</Badge>
          <Badge variant="secondary">{ttr(variant.transmission)}</Badge>
        </div>
        <h1 className="display text-3xl font-semibold md:text-5xl">
          {model.name} <span className="text-muted-foreground">{variant.name}</span>
        </h1>
      </header>

      <div className="mb-8 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft lg:hidden">
        <MobilePrice
          breakup={breakup}
          cityName={cityName}
          labels={{
            onRoad: t("onRoadIn", { city: cityName }),
            none: t("summaryNoPrice", { city: cityName }),
            valid: breakup ? tp("validUntil", { date: formatDateIST(breakup.validUntil, locale) }) : "",
            see: t("viewPriceBreakup"),
          }}
        />
        {ctas}
        {tradeInLink}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:grid-rows-[auto_1fr] lg:gap-x-12">
        <div className="space-y-8 lg:col-start-1">
          <Gallery
            images={model.gallery}
            alts={model.gallery.map((g) => t("imageAlt", { model: name, view: t(viewKey(g)) }))}
          />
          <ColourSwatches colours={variant.colours} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="hidden space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft lg:block">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{t("onRoadIn", { city: cityName })}</p>
              <CityPicker />
            </div>
            {breakup ? (
              <p className="tabular display text-4xl font-semibold">{formatINR(breakup.total)}</p>
            ) : (
              <p className="text-sm">{t("summaryNoPrice", { city: cityName })}</p>
            )}
            {ctas}
            {tradeInLink}
          </div>

          <div id="price" className="scroll-mt-24 space-y-3">
            <div className="lg:hidden">
              <CityPicker />
            </div>
            {breakup ? (
              <PriceBreakup breakup={breakup} cityName={cityName} />
            ) : (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-soft" role="status">
                <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
                  <CircleAlertIcon className="size-5 text-warning" aria-hidden="true" />
                  {tp("notPublishedTitle")}
                </h2>
                <p className="mt-2 mb-4 text-sm text-muted-foreground">
                  {tp("notPublishedBody", { city: cityName })}
                </p>
                <EnquiryDialog
                  itemLabel={name}
                  interest={enquiry}
                  triggerLabel={tp("askPrice")}
                  triggerVariant="default"
                  triggerSize="default"
                />
              </section>
            )}
          </div>

          {/* Text-only offers, separate from (and never changing) the admin on-road price above */}
          <OfferCards offers={offers} locale={locale} modelName={model.name} />

          {breakup ? (
            <EmiCalculator total={breakup.total} />
          ) : (
            <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{temi("noPrice")}</p>
          )}
        </aside>

        <div className="space-y-12 lg:col-start-1">
          <section aria-labelledby="specs-h">
            <h2 id="specs-h" className="mb-4 font-heading text-2xl font-semibold">
              {tv("specsHeading")}
            </h2>
            <table className="w-full overflow-hidden rounded-2xl bg-card text-sm shadow-soft">
              <caption className="sr-only">
                {tv("specsHeading")} — {name}
              </caption>
              <tbody>
                {specRows.map(([k, val]) => (
                  <tr key={k} className="border-b border-border last:border-0">
                    <th scope="row" className="w-1/2 px-5 py-3 text-left font-normal text-muted-foreground">
                      {k}
                    </th>
                    <td className="px-5 py-3 font-medium">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {siblings.length > 0 && (
            <section aria-labelledby="others-h">
              <h2 id="others-h" className="mb-4 font-heading text-2xl font-semibold">
                {tv("otherVariants")}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/cars/${model.slug}/${s.slug}`}
                      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
                    >
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.onRoadFrom !== null
                          ? `${formatLakh(s.onRoadFrom, locale === "hi" ? "hi" : "en")} · ${tc("onRoad")}`
                          : t("fromExShowroom", { price: formatINR(s.exShowroomPrice) })}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function MobilePrice({
  breakup,
  labels,
}: {
  breakup: OnRoadBreakup | null;
  cityName: string;
  labels: { onRoad: string; none: string; valid: string; see: string };
}) {
  if (!breakup) return <p className="text-sm text-muted-foreground">{labels.none}</p>;
  return (
    <div>
      <p className="text-sm text-muted-foreground">{labels.onRoad}</p>
      <p className="tabular display text-3xl font-semibold">{formatINR(breakup.total)}</p>
      <p className="text-xs text-muted-foreground">
        {labels.valid} ·{" "}
        <a href="#price" className="text-primary underline underline-offset-2">
          {labels.see}
        </a>
      </p>
    </div>
  );
}

function humanize(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}
