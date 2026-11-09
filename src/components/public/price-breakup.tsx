import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangleIcon, CalendarClockIcon, InfoIcon } from "lucide-react";
import { formatDateIST, formatINR } from "@/lib/format";
import type { OnRoadBreakup } from "@/types/contracts";

/**
 * On-road price card. Every figure comes from the admin price table via the pricing service;
 * this component only formats it. Labels are translated by `PriceLine.key`.
 */
export async function PriceBreakup({ breakup, cityName }: { breakup: OnRoadBreakup; cityName: string }) {
  const [t, locale] = await Promise.all([getTranslations("price"), getLocale()]);
  const validDate = formatDateIST(breakup.validUntil, locale);
  const captionId = `price-${breakup.variantId}`;

  return (
    <section aria-labelledby={captionId} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 id={captionId} className="font-heading text-lg font-semibold">
          {t("title")} <span className="font-normal text-muted-foreground">{t("inCity", { city: cityName })}</span>
        </h2>
      </div>

      {breakup.isExpired && (
        <p role="alert" className="mb-4 flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("expired", { date: validDate })}
        </p>
      )}

      <table className="tabular w-full text-sm">
        <caption className="sr-only">
          {t("title")} {t("inCity", { city: cityName })}
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t("item")}</th>
            <th scope="col">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {breakup.lines.map((l) => (
            <tr key={l.key} className="border-b border-dashed border-border last:border-0">
              <th scope="row" className="py-2.5 pr-4 text-left font-normal text-foreground/80">
                {t(`lines.${l.key}`)}
                {l.note && l.key === "roadTax" && (
                  <span className="block text-xs text-muted-foreground">{t("roadTaxNote", { pct: l.note.match(/[\d.]+%/)?.[0] ?? "" })}</span>
                )}
              </th>
              <td className="py-2.5 text-right whitespace-nowrap">{formatINR(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground">
            <th scope="row" className="pt-3 text-left font-heading text-base font-semibold">
              {t("total")}
            </th>
            <td className="pt-3 text-right text-2xl font-semibold whitespace-nowrap">{formatINR(breakup.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <CalendarClockIcon className="size-3.5" aria-hidden="true" />
          {t("validUntil", { date: validDate })}
        </p>
        <p className="flex items-center gap-1.5">
          <InfoIcon className="size-3.5" aria-hidden="true" />
          {t("disclaimer")}
        </p>
      </div>
    </section>
  );
}
