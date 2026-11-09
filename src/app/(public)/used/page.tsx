import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontalIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/public/empty-state";
import { NativeSelect } from "@/components/public/native-select";
import { SectionHeading } from "@/components/public/section-heading";
import { UsedCarCard } from "@/components/public/used-car-card";
import { formatLakh, formatNumberIN } from "@/lib/format";
import { listUsedCars, usedCarModelNames } from "@/server/queries/public";
import { FuelEnum, UsedCarFilterSchema, UsedCarStatusEnum, type UsedCarFilter } from "@/types/contracts";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("usedTitle"),
    description: t("usedDescription"),
    alternates: { canonical: "/used" },
    openGraph: { title: t("usedTitle"), description: t("usedDescription"), url: "/used" },
  };
}

// Filter presets (ASSUMPTION: bands chosen to suit the seeded stock; any value works via the URL).
const KM_OPTIONS = [20_000, 40_000, 60_000, 80_000, 1_00_000];
const PRICE_OPTIONS = [4_00_000, 6_00_000, 8_00_000, 10_00_000, 15_00_000];

/** Parse each filter on its own so one bad value doesn't discard the rest. */
function parseFilters(sp: Record<string, string | string[] | undefined>): UsedCarFilter {
  const out: Record<string, unknown> = {};
  const shape = UsedCarFilterSchema.shape;
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const raw = sp[key];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (!v) continue;
    const r = shape[key].safeParse(v);
    if (r.success && r.data !== undefined) out[key] = r.data;
  }
  return out as UsedCarFilter;
}

export default async function UsedPage({ searchParams }: Props) {
  const filters = parseFilters(await searchParams);
  const [t, tf, ts, locale, cars, models] = await Promise.all([
    getTranslations("used"),
    getTranslations("fuel"),
    getTranslations("usedStatus"),
    getLocale(),
    listUsedCars(filters),
    usedCarModelNames(),
  ]);
  const lc = locale === "hi" ? "hi" : "en";
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => thisYear - i);
  const active = Object.keys(filters).length > 0;

  return (
    <div className="container-page pt-10 md:pt-16">
      <SectionHeading as="h1" title={t("title")} subtitle={t("subtitle")} />

      <form
        method="get"
        action="/used"
        aria-label={t("filters")}
        className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-soft md:p-6"
      >
        <p className="mb-4 flex items-center gap-2 font-heading font-semibold">
          <SlidersHorizontalIcon className="size-4 text-primary" aria-hidden="true" />
          {t("filters")}
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="f-model">{t("model")}</Label>
            <NativeSelect id="f-model" name="model" defaultValue={filters.model ?? ""}>
              <option value="">{t("any")}</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-fuel">{t("fuel")}</Label>
            <NativeSelect id="f-fuel" name="fuel" defaultValue={filters.fuel ?? ""}>
              <option value="">{t("any")}</option>
              {FuelEnum.options.map((f) => (
                <option key={f} value={f}>
                  {tf(f)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-year">{t("minYear")}</Label>
            <NativeSelect id="f-year" name="minYear" defaultValue={filters.minYear?.toString() ?? ""}>
              <option value="">{t("any")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-km">{t("maxKm")}</Label>
            <NativeSelect id="f-km" name="maxKm" defaultValue={filters.maxKm?.toString() ?? ""}>
              <option value="">{t("any")}</option>
              {KM_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {t("upTo", { value: `${formatNumberIN(k)} km` })}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-price">{t("maxPrice")}</Label>
            <NativeSelect id="f-price" name="maxPrice" defaultValue={filters.maxPrice?.toString() ?? ""}>
              <option value="">{t("any")}</option>
              {PRICE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {t("upTo", { value: formatLakh(p, lc) })}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-status">{t("status")}</Label>
            <NativeSelect id="f-status" name="status" defaultValue={filters.status ?? ""}>
              <option value="">{t("any")}</option>
              {UsedCarStatusEnum.options.map((s) => (
                <option key={s} value={s}>
                  {ts(s)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit">{t("apply")}</Button>
          {active && (
            <Button asChild variant="ghost">
              <Link href="/used">{t("clear")}</Link>
            </Button>
          )}
          <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
            {t("results", { count: cars.length })}
          </p>
        </div>
      </form>

      {cars.length === 0 ? (
        <EmptyState
          title={t("empty")}
          action={
            <Button asChild variant="outline">
              <Link href="/used">{t("emptyAction")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cars.map((c) => (
            <li key={c.id}>
              <UsedCarCard car={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
