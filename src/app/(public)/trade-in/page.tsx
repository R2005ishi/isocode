import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SectionHeading } from "@/components/public/section-heading";
import { TradeInForm } from "@/components/public/trade-in-form";
import { getSelectedCity } from "@/server/queries/public";
import { listTradeInOptions } from "@/server/workflows/trade-in";

type Props = { searchParams: Promise<{ model?: string; variant?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tradeIn");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/trade-in" },
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: "/trade-in" },
  };
}

/** Buyer trade-in request. Prefill the car of interest with ?model=<slug> or ?variant=<variantId>. */
export default async function TradeInPage({ searchParams }: Props) {
  const [{ model, variant }, t, options, city] = await Promise.all([
    searchParams,
    getTranslations("tradeIn"),
    listTradeInOptions(),
    getSelectedCity(),
  ]);

  let initialModelId: string | undefined;
  let initialVariantId: string | undefined;
  if (variant) {
    const m = options.models.find((x) => x.variants.some((v) => v.id === variant));
    if (m) {
      initialModelId = m.id;
      initialVariantId = variant;
    }
  } else if (model) {
    initialModelId = options.models.find((x) => x.slug === model)?.id;
  }

  return (
    <div className="container-page pt-10 pb-16 md:pt-16">
      <div className="mx-auto max-w-3xl">
        <SectionHeading as="h1" title={t("title")} subtitle={t("subtitle")} />
      </div>
      <TradeInForm
        options={options}
        initialModelId={initialModelId}
        initialVariantId={initialVariantId}
        citySlug={city.slug}
      />
    </div>
  );
}
