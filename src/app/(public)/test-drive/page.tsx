import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/public/empty-state";
import { SectionHeading } from "@/components/public/section-heading";
import { TestDriveWizard } from "@/components/public/test-drive-wizard";
import { listBookingOptions } from "@/server/queries/public";

type Props = { searchParams: Promise<{ variant?: string; model?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("testDriveTitle"),
    description: t("testDriveDescription"),
    alternates: { canonical: "/test-drive" },
    openGraph: { title: t("testDriveTitle"), description: t("testDriveDescription"), url: "/test-drive" },
  };
}

export default async function TestDrivePage({ searchParams }: Props) {
  const [{ variant, model }, t, showrooms] = await Promise.all([
    searchParams,
    getTranslations("testDrive"),
    listBookingOptions(),
  ]);

  // Prefill from ?variant=<variantId> (or ?model=<slug>): first showroom with a matching demo car.
  let initialShowroomId: string | undefined;
  let initialDemoCarId: string | undefined;
  for (const s of showrooms) {
    const match = s.demoCars.find((d) =>
      variant ? d.variantId === variant : model ? d.modelSlug === model : false,
    );
    if (match) {
      initialShowroomId = s.id;
      initialDemoCarId = match.id;
      break;
    }
  }

  return (
    <div className="container-page pt-10 md:pt-16">
      <SectionHeading as="h1" title={t("title")} subtitle={t("subtitle")} />
      {showrooms.length === 0 ? (
        <EmptyState title={t("noDemoCars")} />
      ) : (
        <TestDriveWizard
          showrooms={showrooms}
          initialShowroomId={initialShowroomId}
          initialDemoCarId={initialDemoCarId}
        />
      )}
    </div>
  );
}
