import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/public/empty-state";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceBookingWizard } from "@/components/public/service-booking-wizard";
import { listWorkshops } from "@/server/workflows/service";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ workshop?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("service");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/service" },
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: "/service" },
  };
}

export default async function ServicePage({ searchParams }: Props) {
  const [{ workshop }, t, workshops] = await Promise.all([
    searchParams,
    getTranslations("service"),
    listWorkshops(),
  ]);
  // Prefill from ?workshop=<slug>.
  const initialWorkshopId = workshops.find((w) => w.slug === workshop)?.id;

  return (
    <div className="container-page pt-10 md:pt-16">
      <SectionHeading as="h1" title={t("title")} subtitle={t("subtitle")} />
      {workshops.length === 0 ? (
        <EmptyState title={t("noWorkshops")} />
      ) : (
        <ServiceBookingWizard workshops={workshops} initialWorkshopId={initialWorkshopId} />
      )}
    </div>
  );
}
