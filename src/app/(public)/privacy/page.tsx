import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("privacyTitle"),
    description: t("privacyDescription"),
    alternates: { canonical: "/privacy" },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const what = t.raw("whatItems") as string[];
  const why = t.raw("whyItems") as string[];

  const sections: { title: string; body: React.ReactNode }[] = [
    { title: t("whoTitle"), body: <p>{t("whoBody")}</p> },
    { title: t("whatTitle"), body: <List items={what} /> },
    { title: t("whyTitle"), body: <List items={why} /> },
    { title: t("notTitle"), body: <p>{t("notBody")}</p> },
    // ASSUMPTION: 12-month retention after last contact (see docs/ASSUMPTIONS.md).
    { title: t("howLongTitle"), body: <p>{t("howLongBody")}</p> },
    {
      title: t("rightsTitle"),
      body: (
        <>
          <p>{t("rightsBody")}</p>
          <Button asChild className="mt-4">
            <Link href="/opt-out">{t("optOutCta")}</Link>
          </Button>
        </>
      ),
    },
    { title: t("contactTitle"), body: <p>{t("contactBody")}</p> },
  ];

  return (
    <article className="container-page max-w-3xl pt-10 md:pt-16">
      <h1 className="display mb-3 text-4xl font-semibold md:text-5xl">{t("title")}</h1>
      <p className="mb-10 text-lg text-muted-foreground">{t("updated")}</p>
      <div className="space-y-10">
        {sections.map((s) => (
          <section key={s.title} className="space-y-3 border-t border-border pt-6 leading-relaxed text-foreground/90">
            <h2 className="font-heading text-xl font-semibold text-foreground">{s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </article>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-primary">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
