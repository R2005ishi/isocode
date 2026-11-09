import { getLocale, getTranslations } from "next-intl/server";
import { getSelectedCity, listCities } from "@/server/queries/public";
import { CitySelect } from "./city-select";

/** Server wrapper: loads cities + the selected city, renders the client select. */
export async function CityPicker({ className }: { className?: string }) {
  const [cities, city, locale, t] = await Promise.all([
    listCities(),
    getSelectedCity(),
    getLocale(),
    getTranslations("city"),
  ]);
  return (
    <CitySelect
      className={className}
      label={t("label")}
      value={city.slug}
      cities={cities.map((c) => ({ slug: c.slug, label: (locale === "hi" && c.nameHi) || c.name }))}
    />
  );
}

export function cityLabel(c: { name: string; nameHi: string | null }, locale: string) {
  return (locale === "hi" && c.nameHi) || c.name;
}
