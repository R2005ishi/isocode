import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon, InfoIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/public/empty-state";
import { formatDateTimeIST } from "@/lib/format";
import { getServiceBookingSummary, SERVICE_REFERENCE_RE } from "@/server/workflows/service";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ ref?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("service");
  return { title: t("confirmedTitle"), robots: { index: false, follow: false } };
}

export default async function ServiceConfirmedPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const [t, tc, locale] = await Promise.all([
    getTranslations("service"),
    getTranslations("common"),
    getLocale(),
  ]);
  const reference = typeof ref === "string" && SERVICE_REFERENCE_RE.test(ref) ? ref : null;
  // Only non-personal details are shown (no name/phone; registration masked).
  const booking = reference ? await getServiceBookingSummary(reference) : null;

  if (!booking) {
    return (
      <div className="container-page pt-16">
        <EmptyState
          title={t("missingBooking")}
          action={
            <Button asChild>
              <Link href="/service">{t("bookAnother")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const statusNote =
    booking.status === "CANCELLED" ? t("cancelled") : booking.status === "COMPLETED" ? t("completed") : null;

  return (
    <div className="container-page max-w-2xl pt-10 md:pt-16">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-lift md:p-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center" role="status">
          <CheckCircle2Icon className="size-14 text-success" aria-hidden="true" />
          <h1 className="display text-3xl font-semibold md:text-4xl">{t("confirmedTitle")}</h1>
          <p className="text-muted-foreground">{t("confirmedBody")}</p>
        </div>

        {statusNote && (
          <p className="mb-6 flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {statusNote}
          </p>
        )}

        <div className="mb-6 rounded-2xl bg-muted p-5 text-center">
          <p className="text-sm text-muted-foreground">{t("reference")}</p>
          <p className="tabular font-mono text-3xl font-semibold tracking-widest">{booking.reference}</p>
        </div>

        <dl className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">{t("when")}</dt>
            <dd className="font-medium">{formatDateTimeIST(booking.slotStart, locale)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("where")}</dt>
            <dd className="font-medium">{booking.workshopName}</dd>
            {booking.workshopAddress && (
              <dd className="text-xs text-muted-foreground">{booking.workshopAddress}</dd>
            )}
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("service")}</dt>
            <dd className="font-medium">{t(`serviceTypes.${booking.serviceType}`)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("vehicle")}</dt>
            <dd className="font-medium">
              {booking.modelName} · <span className="tabular">{booking.registrationMasked}</span>
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/service">{t("bookAnother")}</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="flex-1">
            <Link href="/">{tc("goHome")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
