import { setLocaleFromForm } from "@/i18n/actions";
import { cn } from "@/lib/utils";

/**
 * EN / हिं toggle. A plain <form> posting to a server action: it works without JavaScript,
 * sets the NEXT_LOCALE cookie and re-renders the page in the chosen language.
 */
export function LocaleToggle({ locale, label }: { locale: string; label: string }) {
  const options = [
    { value: "en", short: "EN", name: "English" },
    { value: "hi", short: "हिं", name: "हिंदी" },
  ];
  return (
    <form
      action={setLocaleFromForm}
      className="flex items-center rounded-full border border-border bg-card p-0.5 text-xs font-semibold"
      role="group"
      aria-label={label}
    >
      {options.map((o) => {
        const active = o.value === locale;
        return (
          <button
            key={o.value}
            type="submit"
            name="locale"
            value={o.value}
            lang={o.value}
            aria-pressed={active}
            aria-label={o.name}
            className={cn(
              "min-w-9 rounded-full px-2.5 py-1.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.short}
          </button>
        );
      })}
    </form>
  );
}
