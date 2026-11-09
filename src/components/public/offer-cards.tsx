import { TagIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDateIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import { pickLocale } from "@/server/workflows/cms.schema";
import type { LiveOffer } from "@/server/workflows/cms";

/**
 * Live offers as text cards. Deliberately separate from the price: offers never change the on-road
 * figure (the admin price table is the only price source), hence the "subject to dealer terms" note.
 * Renders nothing when there are no live offers.
 */
export async function OfferCards({
  offers,
  locale,
  modelName,
  className,
}: {
  offers: LiveOffer[];
  locale: string;
  modelName?: string;
  className?: string;
}) {
  if (offers.length === 0) return null;
  const t = await getTranslations("offers");
  const headingId = "offers-h";

  return (
    <section aria-labelledby={headingId} className={cn("space-y-3", className)}>
      <h2 id={headingId} className="flex items-center gap-2 font-heading text-lg font-semibold">
        <TagIcon className="size-4 text-primary" aria-hidden="true" />
        {modelName ? t("headingModel", { model: modelName }) : t("heading")}
      </h2>
      <ul className="space-y-3">
        {offers.map((o) => (
          <li key={o.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{pickLocale(locale, o.title, o.titleHi)}</h3>
              {!o.modelId && (
                <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                  {t("allModels")}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{pickLocale(locale, o.body, o.bodyHi)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("validRange", {
                from: formatDateIST(o.validFrom, locale),
                until: formatDateIST(o.validUntil, locale),
              })}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("terms")}</p>
    </section>
  );
}
