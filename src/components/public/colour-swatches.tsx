"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Colour = { name: string; nameHi?: string; hex: string };

export function ColourSwatches({ colours }: { colours: Colour[] }) {
  const t = useTranslations("variant");
  const locale = useLocale();
  const [selected, setSelected] = useState(0);
  if (colours.length === 0) return null;
  const label = (c: Colour) => (locale === "hi" && c.nameHi) || c.name;
  return (
    <fieldset>
      <legend className="mb-3 font-heading text-lg font-semibold">{t("coloursHeading")}</legend>
      <div className="flex flex-wrap gap-3">
        {colours.map((c, i) => (
          <label key={c.hex + c.name} className="relative cursor-pointer" title={label(c)}>
            <input
              type="radio"
              name="colour"
              className="peer sr-only"
              checked={selected === i}
              onChange={() => setSelected(i)}
              aria-label={label(c)}
            />
            <span
              className={cn(
                "block size-10 rounded-full border border-black/10 ring-offset-2 ring-offset-background transition-shadow peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                selected === i && "ring-2 ring-foreground",
              )}
              style={{ backgroundColor: c.hex }}
            />
          </label>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
        {t("colourSelected", { name: label(colours[selected]!) })}
      </p>
    </fieldset>
  );
}
