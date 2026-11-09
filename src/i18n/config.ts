export const LOCALES = ["en", "hi"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** City cookie for on-road prices. ASSUMPTION: Lucknow is the default city (dealer's home city). */
export const CITY_COOKIE = "city";
export const DEFAULT_CITY = "lucknow";

export function isLocale(v: unknown): v is AppLocale {
  return v === "en" || v === "hi";
}
