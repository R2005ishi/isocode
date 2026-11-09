"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CarImage } from "./car-image";

/** Main image + thumbnail strip. First image is the LCP candidate (`priority`). */
export function Gallery({ images, alts }: { images: string[]; alts: string[] }) {
  const t = useTranslations("model");
  const [active, setActive] = useState(0);
  const src = images[active] ?? images[0];
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-muted/70 to-card px-2 pt-6 pb-2 md:px-8">
        <CarImage src={src} alt={alts[active] ?? ""} priority sizes="(min-width: 1024px) 60vw, 100vw" />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2" aria-label={t("galleryHeading")}>
          {images.map((img, i) => (
            <li key={img}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                aria-label={alts[i]}
                className={cn(
                  "w-24 overflow-hidden rounded-lg border-2 bg-muted/60 p-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:w-28",
                  i === active ? "border-primary" : "border-transparent hover:border-border",
                )}
              >
                <CarImage src={img} alt="" sizes="112px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
