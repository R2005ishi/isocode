import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OptOutForm } from "@/components/public/opt-out-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("optOutTitle"),
    description: t("optOutDescription"),
    alternates: { canonical: "/opt-out" },
  };
}

export default async function OptOutPage() {
  const t = await getTranslations("optOut");
  return (
    <div className="container-page max-w-xl pt-10 md:pt-16">
      <h1 className="display mb-3 text-4xl font-semibold">{t("title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("body")}</p>
      <OptOutForm />
    </div>
  );
}
