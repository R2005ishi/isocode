import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatLakh } from "@/lib/format";
import type { ModelSummary } from "@/server/queries/public";
import { CarImage } from "./car-image";

export async function ModelCard({ model, cityName }: { model: ModelSummary; cityName: string }) {
  const [t, tb, tc, locale] = await Promise.all([
    getTranslations("model"),
    getTranslations("bodyType"),
    getTranslations("common"),
    getLocale(),
  ]);
  const lc = locale === "hi" ? "hi" : "en";
  return (
    <Link
      href={`/cars/${model.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all outline-none hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="bg-gradient-to-b from-muted/40 to-card px-4 pt-6">
        <CarImage
          src={model.heroImage}
          alt={t("imageAlt", { model: model.name, view: t("viewFront") })}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="display text-2xl font-semibold">{model.name}</h3>
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {tb.has(model.bodyType) ? tb(model.bodyType) : model.bodyType}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{model.description}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            {model.onRoadFrom !== null ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {tc("from")} · {tc("onRoad")} · {cityName}
                </p>
                <p className="tabular text-xl font-semibold">{formatLakh(model.onRoadFrom, lc)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("priceNotPublishedShort", { city: cityName })}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{tc("variants", { count: model.variantCount })}</p>
          </div>
          <span className="grid size-10 place-items-center rounded-full bg-foreground text-background transition-colors group-hover:bg-primary">
            <ArrowUpRightIcon className="size-5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
