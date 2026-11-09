import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2Icon, InfoIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { EnquiryDialog } from "@/components/public/enquiry-dialog";
import { Gallery } from "@/components/public/gallery";
import { JsonLd } from "@/components/public/json-ld";
import { formatINR, formatLakh, formatNumberIN } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { getUsedCar } from "@/server/queries/public";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const car = await getUsedCar(slug);
  if (!car) notFound();
  const [tc, tf, locale] = await Promise.all([getTranslations("common"), getTranslations("fuel"), getLocale()]);
  const name = `${car.year} ${car.modelName} ${car.variantName}`;
  const title = `${name} — ${formatLakh(car.price, locale === "hi" ? "hi" : "en")}`;
  const description = `${name}, ${tf(car.fuel)}, ${tc("km", { km: formatNumberIN(car.km) })}, ${tc("owners", {
    count: car.owners,
  })}. ${formatINR(car.price)}.`;
  const url = `/used/${car.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: car.images[0] ? [{ url: car.images[0] }] : undefined },
    robots: car.status === "SOLD" ? { index: false, follow: true } : undefined,
  };
}

export default async function UsedCarPage({ params }: Props) {
  const { slug } = await params;
  const car = await getUsedCar(slug);
  if (!car) notFound();

  const [t, tc, tf, ttr, ts] = await Promise.all([
    getTranslations("used"),
    getTranslations("common"),
    getTranslations("fuel"),
    getTranslations("transmission"),
    getTranslations("usedStatus"),
  ]);
  const name = `${car.year} ${car.modelName} ${car.variantName}`;
  const url = `/used/${car.slug}`;
  const images = car.images.length ? car.images : ["/cars/model-h.svg"];

  const facts: [string, string][] = [
    [t("year"), String(car.year)],
    [t("kms"), tc("km", { km: formatNumberIN(car.km) })],
    [t("owners"), tc("owners", { count: car.owners })],
    [t("fuelTransmission"), `${tf(car.fuel)} · ${ttr(car.transmission)}`],
    ...(car.colour ? ([[t("colour"), car.colour]] as [string, string][]) : []),
    [t("stock"), car.stockId],
  ];

  const inspectionIcon = {
    OK: <CheckCircle2Icon className="size-4 text-success" aria-hidden="true" />,
    ATTENTION: <TriangleAlertIcon className="size-4 text-warning" aria-hidden="true" />,
    REPLACED: <RefreshCwIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
  } as const;

  const cta =
    car.status === "SOLD" ? (
      <Button asChild size="lg" className="w-full">
        <Link href="/used">{t("browseSimilar")}</Link>
      </Button>
    ) : (
      <EnquiryDialog
        itemLabel={name}
        interest={{ interestUsedCarId: car.id }}
        triggerLabel={t("enquireCta")}
        triggerVariant="default"
        triggerClassName="w-full"
      />
    );

  return (
    <div className="container-page pt-6 md:pt-10">
      <Breadcrumbs
        items={[
          { href: "/used", label: t("breadcrumb") },
          { href: url, label: name },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Car",
          name: `Brand X ${name}`,
          url: absoluteUrl(url),
          image: images.map((i) => absoluteUrl(i)),
          brand: { "@type": "Brand", name: "Brand X" },
          model: car.modelName,
          vehicleConfiguration: car.variantName,
          vehicleModelDate: String(car.year),
          fuelType: car.fuel,
          vehicleTransmission: car.transmission,
          numberOfPreviousOwners: car.owners,
          mileageFromOdometer: { "@type": "QuantitativeValue", value: car.km, unitCode: "KMT" },
          itemCondition: "https://schema.org/UsedCondition",
          sku: car.stockId,
          ...(car.colour ? { color: car.colour } : {}),
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: car.price,
            availability:
              car.status === "AVAILABLE"
                ? "https://schema.org/InStock"
                : car.status === "BOOKED"
                  ? "https://schema.org/LimitedAvailability"
                  : "https://schema.org/SoldOut",
            url: absoluteUrl(url),
            seller: { "@type": "AutoDealer", name: "Company A" },
          },
        }}
      />

      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
        <div className="order-2 space-y-10 lg:order-1">
          <Gallery images={images} alts={images.map((_, i) => t("photoAlt", { car: name, n: i + 1 }))} />

          <section aria-labelledby="insp-h">
            <h2 id="insp-h" className="mb-4 font-heading text-2xl font-semibold">
              {t("inspectionHeading")}
            </h2>
            {car.inspection.length === 0 ? (
              <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("inspectionEmpty")}</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                {car.inspection.map((i) => (
                  <li key={i.item} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5">{inspectionIcon[i.result]}</span>
                    <div className="flex-1">
                      <p className="font-medium">{i.item}</p>
                      {i.note && <p className="text-sm text-muted-foreground">{i.note}</p>}
                    </div>
                    <Badge
                      variant={i.result === "OK" ? "success" : i.result === "ATTENTION" ? "warning" : "secondary"}
                    >
                      {t(`inspection.${i.result}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="order-1 lg:order-2">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft lg:sticky lg:top-24">
            <div className="space-y-2">
              {car.status !== "AVAILABLE" && (
                <Badge variant={car.status === "SOLD" ? "secondary" : "warning"}>{ts(car.status)}</Badge>
              )}
              <h1 className="display text-3xl font-semibold">{name}</h1>
              <p className="text-sm text-muted-foreground">
                {tc("km", { km: formatNumberIN(car.km) })} · {tc("owners", { count: car.owners })} · {tf(car.fuel)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("askingPrice")}</p>
              <p className="tabular display text-4xl font-semibold">{formatINR(car.price)}</p>
            </div>
            {car.status === "SOLD" && <p className="text-sm text-muted-foreground">{t("soldNote")}</p>}
            {car.status === "BOOKED" && <p className="text-sm text-warning">{t("bookedNote")}</p>}
            {cta}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-5 text-sm">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-muted-foreground">{t("registration")}</dt>
                <dd className="tabular font-mono font-medium tracking-wider">{car.registrationMasked}</dd>
                <dd className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                  <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {t("regNote")}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
