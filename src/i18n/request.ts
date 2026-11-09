import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

/**
 * Feature namespaces live in their own files (messages/features/<ns>.<locale>.json) so features
 * can be built in parallel without editing the same JSON file. Each becomes a top-level namespace.
 */
const FEATURE_NAMESPACES = ["service", "tradeIn", "offers"] as const;

// No locale-prefixed routes: the locale comes from the NEXT_LOCALE cookie (en | hi).
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const base = (await import(`../../messages/${locale}.json`)).default;
  const features = await Promise.all(
    FEATURE_NAMESPACES.map(
      async (ns) => [ns, (await import(`../../messages/features/${ns}.${locale}.json`)).default] as const,
    ),
  );
  return {
    locale,
    timeZone: "Asia/Kolkata",
    messages: { ...base, ...Object.fromEntries(features) },
  };
});
