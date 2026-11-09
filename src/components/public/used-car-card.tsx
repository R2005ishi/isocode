import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { formatLakh, formatNumberIN } from "@/lib/format";
import type { UsedCarPublic } from "@/types/contracts";
import { CarImage } from "./car-image";

export async function UsedCarCard({ car }: { car: UsedCarPublic }) {
  const [t, tf, ts, tc, locale] = await Promise.all([
    getTranslations("used"),
    getTranslations("fuel"),
    getTranslations("usedStatus"),
    getTranslations("common"),
    getLocale(),
  ]);
  const title = `${car.year} ${car.modelName} ${car.variantName}`;
  return (
    <Link
      href={`/used/${car.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all outline-none hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative bg-muted/50 px-4 pt-4">
        {car.status !== "AVAILABLE" && (
          <Badge variant={car.status === "SOLD" ? "secondary" : "warning"} className="absolute top-3 left-3">
            {ts(car.status)}
          </Badge>
        )}
        <CarImage
          src={car.images[0] ?? "/cars/model-h.svg"}
          alt={t("photoAlt", { car: title, n: 1 })}
          sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 85vw"
          className={car.status === "SOLD" ? "opacity-60 grayscale" : undefined}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <h3 className="font-heading text-lg leading-tight font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {tc("km", { km: formatNumberIN(car.km) })} · {tc("owners", { count: car.owners })} · {tf(car.fuel)}
        </p>
        <p className="tabular mt-auto pt-3 text-lg font-semibold">
          {formatLakh(car.price, locale === "hi" ? "hi" : "en")}
        </p>
      </div>
    </Link>
  );
}
