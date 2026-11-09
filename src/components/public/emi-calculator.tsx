"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Slider } from "@/components/ui/slider";
import { formatINR, formatNumberIN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { computeEmi, EMI_DEFAULTS } from "@/server/services/emi";

const TENURES = [12, 24, 36, 48, 60, 72, 84];

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** EMI calculator island. `total` is the on-road total from the admin price table. */
export function EmiCalculator({ total }: { total: number }) {
  const t = useTranslations("emi");
  const id = useId();
  const roundTo = 5_000;
  const defaultDown = Math.round((total * EMI_DEFAULTS.downPaymentPct) / 100 / roundTo) * roundTo;
  const [down, setDown] = useState(defaultDown);
  const [rate, setRate] = useState<number>(EMI_DEFAULTS.annualRatePct);
  const [tenure, setTenure] = useState<number>(EMI_DEFAULTS.tenureMonths);

  const principal = total - down;
  const result = useMemo(() => {
    try {
      if (principal <= 0) return null;
      return computeEmi({ principal, annualRatePct: rate, tenureMonths: tenure });
    } catch {
      return null; // RangeError on invalid input → show the hint instead of a number
    }
  }, [principal, rate, tenure]);

  return (
    <section aria-labelledby={`${id}-t`} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 id={`${id}-t`} className="font-heading text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">{t("subtitle", { total: formatINR(total) })}</p>

      <div className="space-y-6">
        <Field
          id={`${id}-down`}
          label={t("downPayment")}
          prefix="₹"
          value={down}
          display={formatNumberIN(down)}
          min={0}
          max={total}
          step={roundTo}
          onChange={(v) => setDown(clamp(Math.round(v), 0, total))}
        />
        <Field
          id={`${id}-rate`}
          label={t("rate")}
          suffix="%"
          value={rate}
          display={String(rate)}
          min={5}
          max={20}
          step={0.1}
          onChange={(v) => setRate(clamp(Math.round(v * 100) / 100, 0, 30))}
        />
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("tenure")}</legend>
          <div className="flex flex-wrap gap-2">
            {TENURES.map((m) => (
              <label
                key={m}
                className={cn(
                  "relative cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  tenure === m
                    ? "border-primary bg-primary-soft font-semibold text-primary"
                    : "border-border hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-tenure`}
                  value={m}
                  checked={tenure === m}
                  onChange={() => setTenure(m)}
                  className="sr-only"
                />
                {t("months", { count: m })}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-6 rounded-xl bg-foreground p-5 text-background" aria-live="polite">
        {result ? (
          <>
            <p className="text-sm opacity-75">{t("monthly")}</p>
            <p className="tabular display text-4xl font-semibold">
              {formatINR(result.emi)}
              <span className="text-base font-normal opacity-75">{t("perMonth")}</span>
            </p>
            <dl className="tabular mt-4 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="opacity-70">{t("loanAmount")}</dt>
                <dd className="text-sm font-semibold">{formatINR(principal)}</dd>
              </div>
              <div>
                <dt className="opacity-70">{t("totalInterest")}</dt>
                <dd className="text-sm font-semibold">{formatINR(result.totalInterest)}</dd>
              </div>
              <div>
                <dt className="opacity-70">{t("totalPayable")}</dt>
                <dd className="text-sm font-semibold">{formatINR(result.totalPayable)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-sm">{t("invalid")}</p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  prefix,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex h-10 items-center rounded-md border border-input bg-card px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
          <input
            id={id}
            inputMode="decimal"
            className="tabular w-24 bg-transparent text-right text-sm font-semibold outline-none"
            value={draft ?? display}
            onFocus={() => setDraft(String(value))}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value.replace(/[^\d.]/g, ""));
              if (Number.isFinite(n) && e.target.value.trim() !== "") onChange(n);
            }}
            onBlur={() => setDraft(null)}
          />
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[clamp(value, min, max)]}
        onValueChange={(v) => {
          setDraft(null);
          onChange(v[0] ?? min);
        }}
      />
    </div>
  );
}
