"use client";

import { useTransition } from "react";
import { MapPinIcon } from "lucide-react";
import { setCity } from "@/i18n/actions";
import { cn } from "@/lib/utils";

/**
 * City selector for on-road prices. Saves the `city` cookie through a server action; the page
 * re-renders with that city's admin price rows. Uses a native <select> for the best phone UX.
 */
export function CitySelect({
  cities,
  value,
  label,
  className,
}: {
  cities: { slug: string; label: string }[];
  value: string;
  label: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <label
      className={cn(
        "relative inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card pr-3 pl-3 text-sm shadow-soft transition-opacity",
        pending && "opacity-60",
        className,
      )}
    >
      <MapPinIcon className="size-4 text-primary" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <select
        className="cursor-pointer appearance-none bg-transparent pr-5 font-semibold outline-none focus-visible:underline"
        value={value}
        disabled={pending}
        aria-busy={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(() => setCity(next));
        }}
      >
        {cities.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>
      <svg aria-hidden="true" viewBox="0 0 12 12" className="pointer-events-none absolute right-3 size-3 text-muted-foreground">
        <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </label>
  );
}
