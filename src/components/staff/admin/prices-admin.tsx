"use client";

import { useMemo, useState } from "react";
import { CircleAlertIcon, Loader2Icon, RotateCcwIcon, SaveIcon, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { computeOnRoad } from "@/server/services/pricing";
import { AdminPriceSchema } from "@/types/contracts";
import { EmptyState, ErrorState, PageHeader } from "../states";
import { formatStaffDate } from "../labels";
import { adminApi, useAdminList, useAdminMutation, useLookups } from "./shared";
import type { AdminPrice, AdminVariant } from "./types";

type City = { id: string; name: string; slug: string };
type FieldKey = "roadTaxPct" | "registrationFee" | "insurance" | "accessoriesPack" | "otherCharges" | "validUntil";
type Draft = Record<FieldKey, string>;

const COLS: { key: FieldKey; label: string; short: string; suffix?: string }[] = [
  { key: "roadTaxPct", label: "Road tax %", short: "Tax %", suffix: "%" },
  { key: "registrationFee", label: "Registration ₹", short: "Reg. ₹" },
  { key: "insurance", label: "Insurance ₹", short: "Ins. ₹" },
  { key: "accessoriesPack", label: "Accessories ₹", short: "Acc. ₹" },
  { key: "otherCharges", label: "Other ₹", short: "Other ₹" },
  { key: "validUntil", label: "Valid until", short: "Valid until" },
];

const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const istDate = (d: Date) => IST_DATE.format(d); // YYYY-MM-DD

function fromRow(p: AdminPrice): Draft {
  return {
    roadTaxPct: String(p.roadTaxPct),
    registrationFee: String(p.registrationFee),
    insurance: String(p.insurance),
    accessoriesPack: String(p.accessoriesPack),
    otherCharges: String(p.otherCharges),
    validUntil: istDate(new Date(p.validUntil)),
  };
}

/**
 * Starting values for a city that has no row yet, so the admin only reviews and saves.
 * ASSUMPTION (docs/ASSUMPTIONS.md › Pricing): UP road tax 8 % below ₹10 lakh, 10 % at/above;
 * registration ₹2,100; insurance ≈ 3.2 % of ex-showroom; accessories ₹15,000; valid 30 days.
 */
function suggested(exShowroom: number): Draft {
  return {
    roadTaxPct: exShowroom >= 1_000_000 ? "10" : "8",
    registrationFee: "2100",
    insurance: String(Math.round(exShowroom * 0.032)),
    accessoriesPack: "15000",
    otherCharges: "0",
    validUntil: istDate(new Date(Date.now() + 30 * 86_400_000)),
  };
}

function parseDraft(d: Draft, variantId: string, cityId: string) {
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/[,\s]/g, "")));
  return AdminPriceSchema.safeParse({
    variantId,
    cityId,
    roadTaxPct: num(d.roadTaxPct),
    registrationFee: num(d.registrationFee),
    insurance: num(d.insurance),
    accessoriesPack: num(d.accessoriesPack),
    otherCharges: num(d.otherCharges),
    validUntil: d.validUntil,
  });
}

export function PricesAdmin() {
  const lookups = useLookups();
  const variants = useAdminList<AdminVariant>("variants");
  const prices = useAdminList<AdminPrice>("prices");
  const [modelId, setModelId] = useState("ALL");
  const [cityId, setCityId] = useState("ALL");
  const [onlyProblems, setOnlyProblems] = useState(false);

  const priceMap = useMemo(() => {
    const m = new Map<string, AdminPrice>();
    for (const p of prices.data ?? []) m.set(`${p.variantId}:${p.cityId}`, p);
    return m;
  }, [prices.data]);

  const loading = lookups.isPending || variants.isPending || prices.isPending;
  const error = lookups.error ?? variants.error ?? prices.error;
  const now = Date.now();

  if (loading)
    return (
      <div>
        <PageHeader title="City price table" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  if (error)
    return (
      <div>
        <PageHeader title="City price table" />
        <ErrorState
          error={error}
          onRetry={() => {
            lookups.refetch();
            variants.refetch();
            prices.refetch();
          }}
        />
      </div>
    );

  const cities: City[] = lookups.data!.cities.filter((c) => cityId === "ALL" || c.id === cityId);
  const allVariants = variants.data!.filter((v) => modelId === "ALL" || v.modelId === modelId);
  const isProblem = (v: AdminVariant, c: City) => {
    const p = priceMap.get(`${v.id}:${c.id}`);
    return !p || new Date(p.validUntil).getTime() < now;
  };
  const shown = allVariants
    .map((v) => ({ v, cities: onlyProblems ? cities.filter((c) => isProblem(v, c)) : cities }))
    .filter((g) => g.cities.length > 0);
  const totalCells = variants.data!.length * lookups.data!.cities.length;
  const problemCount = variants.data!.reduce(
    (n, v) => n + lookups.data!.cities.filter((c) => isProblem(v, c)).length,
    0,
  );

  return (
    <div>
      <PageHeader
        title="City price table"
        description={
          <>
            The only source of on-road prices on the site — AI never sets prices.{" "}
            <span className={cn(problemCount > 0 && "font-medium text-amber-800 dark:text-amber-400")}>
              {problemCount} of {totalCells} variant × city rows missing or expired.
            </span>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={modelId} onValueChange={setModelId}>
          <SelectTrigger size="sm" className="min-w-40 bg-background" aria-label="Filter by model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All models</SelectItem>
            {lookups.data!.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cityId} onValueChange={setCityId}>
          <SelectTrigger size="sm" className="min-w-36 bg-background" aria-label="Filter by city">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All cities</SelectItem>
            {lookups.data!.cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex h-8 items-center gap-2 rounded-lg border bg-background px-3 text-sm">
          <Checkbox checked={onlyProblems} onCheckedChange={(c) => setOnlyProblems(c === true)} />
          Only missing or expired
        </label>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={TableIcon}
          title={onlyProblems ? "Every price row is published and current" : "No variants to price"}
          description={onlyProblems ? "Nothing needs attention." : "Add variants on the Models & variants tab first."}
        />
      ) : (
        <div className="space-y-4">
          {shown.map(({ v, cities: cs }) => (
            <section key={v.id} className="overflow-hidden rounded-xl border bg-background">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
                <h2 className="text-sm font-semibold">
                  {v.model.name} {v.name}
                  {!v.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">(inactive)</span>}
                </h2>
                <span className="text-xs text-muted-foreground">
                  Ex-showroom <span className="font-medium text-foreground tabular-nums">{formatINR(v.exShowroomPrice)}</span>
                </span>
              </header>
              <div
                className="hidden gap-2 border-b px-4 py-2 text-xs font-medium text-muted-foreground lg:grid"
                style={{ gridTemplateColumns: GRID }}
              >
                <span>City</span>
                {COLS.map((c) => (
                  <span key={c.key}>{c.short}</span>
                ))}
                <span className="text-right">On-road total</span>
                <span />
              </div>
              <ul className="divide-y">
                {cs.map((c) => (
                  <PriceRow
                    key={`${v.id}:${c.id}:${priceMap.get(`${v.id}:${c.id}`)?.updatedAt ?? "new"}`}
                    variant={v}
                    city={c}
                    row={priceMap.get(`${v.id}:${c.id}`) ?? null}
                    now={now}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const GRID = "8rem repeat(5, minmax(0, 1fr)) 9.5rem 8.5rem 7.5rem";

function PriceRow({ variant, city, row, now }: { variant: AdminVariant; city: City; row: AdminPrice | null; now: number }) {
  const initial = useMemo(() => (row ? fromRow(row) : suggested(variant.exShowroomPrice)), [row, variant.exShowroomPrice]);
  const [draft, setDraft] = useState<Draft>(initial);
  const parsed = parseDraft(draft, variant.id, city.id);
  const errors: Partial<Record<FieldKey, string>> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[i.path[0] as FieldKey] ??= i.message;
  const dirty = !row || COLS.some((c) => draft[c.key] !== initial[c.key]);
  const expired = row ? new Date(row.validUntil).getTime() < now : false;

  let total: number | null = null;
  if (parsed.success) {
    try {
      // Same function the buyer page uses, so the preview always matches what buyers will see.
      total = computeOnRoad(
        variant.exShowroomPrice,
        {
          roadTaxPct: parsed.data.roadTaxPct,
          registrationFee: parsed.data.registrationFee,
          insurance: parsed.data.insurance,
          accessoriesPack: parsed.data.accessoriesPack,
          otherCharges: parsed.data.otherCharges,
          validUntil: new Date(`${draft.validUntil}T23:59:59+05:30`),
        },
        { variantId: variant.id, citySlug: city.slug, cityName: city.name },
      ).total;
    } catch {
      total = null;
    }
  }

  const save = useAdminMutation(
    "prices",
    () => {
      if (!parsed.success) throw new Error("Fix the highlighted fields first");
      const body = { ...parsed.data, validUntil: draft.validUntil };
      return row ? adminApi.update<AdminPrice>("prices", row.id, body) : adminApi.create<AdminPrice>("prices", body);
    },
    { success: `${variant.name} · ${city.name} price saved` },
  );

  const set = (k: FieldKey, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <li
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-3 lg:[grid-template-columns:var(--lg-grid)] lg:items-start lg:gap-2",
        !row && "bg-amber-50/60 dark:bg-amber-950/20",
        expired && "bg-red-50/60 dark:bg-red-950/20",
      )}
      style={{ ["--lg-grid" as string]: GRID }}
    >
      <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-3 lg:col-span-1 lg:block lg:pt-1.5">
        <p className="text-sm font-medium">{city.name}</p>
        {!row ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-400">
            <CircleAlertIcon className="size-3" aria-hidden /> Not published
          </span>
        ) : expired ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
            <CircleAlertIcon className="size-3" aria-hidden /> Expired {formatStaffDate(row.validUntil)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Saved {formatStaffDate(row.updatedAt)}</span>
        )}
      </div>
      {COLS.map((c) => {
        const id = `${variant.id}-${city.id}-${c.key}`;
        return (
          <div key={c.key} className="min-w-0 space-y-1">
            <Label htmlFor={id} className="text-xs text-muted-foreground lg:sr-only">
              {c.label}
            </Label>
            <Input
              id={id}
              type={c.key === "validUntil" ? "date" : "text"}
              inputMode={c.key === "roadTaxPct" ? "decimal" : c.key === "validUntil" ? undefined : "numeric"}
              value={draft[c.key]}
              onChange={(e) => set(c.key, e.target.value)}
              aria-invalid={!!errors[c.key]}
              aria-describedby={errors[c.key] ? `${id}-err` : undefined}
              className="h-9 bg-background px-2 text-sm tabular-nums"
            />
            {errors[c.key] && (
              <p id={`${id}-err`} className="text-[11px] leading-tight text-destructive">
                {errors[c.key]}
              </p>
            )}
          </div>
        );
      })}
      <div className="flex flex-col justify-center lg:items-end lg:pt-1.5">
        <span className="text-xs text-muted-foreground lg:sr-only">On-road total</span>
        <span className="text-base font-semibold tabular-nums lg:text-sm" aria-live="polite">
          {total !== null ? formatINR(total) : "—"}
        </span>
      </div>
      <div className="col-span-2 flex items-start justify-end gap-1 sm:col-span-3 lg:col-span-1">
        {row && dirty && (
          <Button size="icon-sm" variant="ghost" className="mt-1" onClick={() => setDraft(initial)} aria-label="Undo changes">
            <RotateCcwIcon />
          </Button>
        )}
        <Button
          size="sm"
          className="mt-0.5 h-8"
          variant={dirty ? "default" : "outline"}
          disabled={!dirty || !parsed.success || save.isPending}
          onClick={() => save.mutate(undefined)}
        >
          {save.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {row ? (dirty ? "Save" : "Saved") : "Publish"}
        </Button>
      </div>
    </li>
  );
}
