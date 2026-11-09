import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CarFrontIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function NotFoundState() {
  const [t, tc] = await Promise.all([getTranslations("states"), getTranslations("common")]);
  return (
    <div className="container-page flex flex-col items-center gap-4 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <CarFrontIcon className="size-7" aria-hidden="true" />
      </span>
      <p className="tabular font-mono text-sm text-muted-foreground">404</p>
      <h1 className="display text-3xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="max-w-md text-muted-foreground">{t("notFoundBody")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/cars">{t("browseCars")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">{tc("goHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
