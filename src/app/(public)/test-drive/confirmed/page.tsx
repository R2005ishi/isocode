import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { BookingAck } from "@/components/public/booking-ack";
import { EmptyState } from "@/components/public/empty-state";
import { formatDateTimeIST } from "@/lib/format";
import { getBookingSummary } from "@/server/queries/public";

type Props = { searchParams: Promise<{ ref?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("testDrive");
  return { title: t("confirmedTitle"), robots: { index: false, follow: false } };
}

export default async function ConfirmedPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const [t, tc, locale] = await Promise.all([
    getTranslations("testDrive"),
    getTranslations("common"),
    getLocale(),
  ]);
  const reference = typeof ref === "string" && /^TD-[A-Z0-9]{3,12}$/.test(ref) ? ref : null;
  const booking = reference ? await getBookingSummary(reference) : null;

  if (!booking) {
    return (
      <div className="container-page pt-16">
        <EmptyState
          title={t("missingBooking")}
          action={
            <Button asChild>
              <Link href="/test-drive">{t("bookAnother")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const car = `${booking.demoCar.variant.model.name} ${booking.demoCar.variant.name}`;
  return (
    <div className="container-page max-w-2xl pt-10 md:pt-16">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-lift md:p-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center" role="status">
          <CheckCircle2Icon className="size-14 text-success" aria-hidden="true" />
          <h1 className="display text-3xl font-semibold md:text-4xl">{t("confirmedTitle")}</h1>
          <p className="text-muted-foreground">{t("confirmedBody")}</p>
        </div>

        <div className="mb-6 rounded-2xl bg-muted p-5 text-center">
          <p className="text-sm text-muted-foreground">{t("reference")}</p>
          <p className="tabular font-mono text-3xl font-semibold tracking-widest">{booking.reference}</p>
        </div>

        <dl className="mb-6 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">{t("when")}</dt>
            <dd className="font-medium">{formatDateTimeIST(booking.slotStart, locale)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("where")}</dt>
            <dd className="font-medium">{booking.showroom.name}</dd>
            <dd className="text-xs text-muted-foreground">{booking.showroom.address}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("car")}</dt>
            <dd className="font-medium">{car}</dd>
          </div>
        </dl>

        <BookingAck reference={booking.reference} />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/test-drive">{t("bookAnother")}</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="flex-1">
            <Link href="/">{tc("goHome")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
