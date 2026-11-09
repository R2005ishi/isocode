import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CityPicker, cityLabel } from "@/components/public/city-picker";
import { EmptyState } from "@/components/public/empty-state";
import { ModelCard } from "@/components/public/model-card";
import { SectionHeading } from "@/components/public/section-heading";
import { getSelectedCity, listModels } from "@/server/queries/public";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("model");
  return {
    title: t("carsTitle"),
    description: t("carsDescription"),
    alternates: { canonical: "/cars" },
    openGraph: { title: t("carsTitle"), description: t("carsDescription"), url: "/cars" },
  };
}

export default async function CarsPage() {
  const [t, th, locale, city] = await Promise.all([
    getTranslations("model"),
    getTranslations("home"),
    getLocale(),
    getSelectedCity(),
  ]);
  const models = await listModels(city.slug, locale);
  const cityName = cityLabel(city, locale);
  return (
    <div className="container-page pt-10 md:pt-16">
      <SectionHeading
        as="h1"
        title={t("carsTitle")}
        subtitle={th("modelsSub", { city: cityName })}
        action={<CityPicker />}
      />
      {models.length === 0 ? (
        <EmptyState title={th("modelsEmpty")} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {models.map((m) => (
            <ModelCard key={m.id} model={m} cityName={cityName} />
          ))}
        </div>
      )}
    </div>
  );
}
