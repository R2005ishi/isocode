"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Body of every buyer-side `error.tsx`: friendly message + retry. */
export function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("states");
  const tc = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex flex-col items-center gap-4 py-20 text-center" role="alert">
      <span className="grid size-14 place-items-center rounded-full bg-destructive-soft text-destructive">
        <TriangleAlertIcon className="size-7" aria-hidden="true" />
      </span>
      <h1 className="display text-3xl font-semibold">{t("errorTitle")}</h1>
      <p className="max-w-md text-muted-foreground">{t("errorBody")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={reset}>
          <RotateCwIcon aria-hidden="true" /> {tc("retry")}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">{tc("goHome")}</Link>
        </Button>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground">Ref: {error.digest}</p>}
    </div>
  );
}
