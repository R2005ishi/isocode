"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon, ChevronLeftIcon, Loader2Icon, MapPinIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateIST, formatDateTimeIST, isoDateIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BookingShowroom } from "@/server/queries/public";
import { BOOKING_WINDOW_DAYS, SLOT_MINUTES } from "@/server/services/slots";
import { TestDriveCreateSchema, type Slot, type TestDriveCreated } from "@/types/contracts";
import { ApiClientError, errorKey, getJson, postJson } from "./api";
import { CarImage } from "./car-image";
import { ConsentField, FormAlert, TextField, useFieldError } from "./form-fields";

type In = z.input<typeof TestDriveCreateSchema>;
type Out = z.output<typeof TestDriveCreateSchema>;

export const CONFIRMATION_KEY = (ref: string) => `td:${ref}`;

export function TestDriveWizard({
  showrooms,
  initialShowroomId,
  initialDemoCarId,
}: {
  showrooms: BookingShowroom[];
  initialShowroomId?: string;
  initialDemoCarId?: string;
}) {
  const t = useTranslations("testDrive");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const fieldError = useFieldError();

  const [step, setStep] = useState(1);
  const [showroomId, setShowroomId] = useState(initialShowroomId ?? showrooms[0]?.id ?? "");
  const [demoCarId, setDemoCarId] = useState(initialDemoCarId ?? "");
  const [date, setDate] = useState(() => isoDateIST(0));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const showroom = showrooms.find((s) => s.id === showroomId);
  const car = showroom?.demoCars.find((d) => d.id === demoCarId);
  const carName = (c: { modelName: string; variantName: string }) => `${c.modelName} ${c.variantName}`;

  // Today + the next BOOKING_WINDOW_DAYS days, as IST calendar dates.
  const days = useMemo(
    () => Array.from({ length: BOOKING_WINDOW_DAYS + 1 }, (_, i) => isoDateIST(i)),
    [],
  );

  // Load real free slots whenever the car or date changes (or after a SLOT_TAKEN conflict).
  useEffect(() => {
    if (step !== 2 || !showroomId || !demoCarId) return;
    const ctrl = new AbortController();
    setSlots(null);
    setSlotsError(false);
    const qs = new URLSearchParams({ showroomId, demoCarId, date });
    getJson<Slot[]>(`/api/slots?${qs}`, ctrl.signal)
      .then(setSlots)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setSlotsError(true);
      });
    return () => ctrl.abort();
  }, [step, showroomId, demoCarId, date, reloadKey]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(TestDriveCreateSchema),
    defaultValues: {
      showroomId: "",
      demoCarId: "",
      slotStart: "",
      name: "",
      phone: "",
      email: "",
      locale: locale === "hi" ? "hi" : "en",
      consent: false as unknown as true, // DPDP: unticked by default
    },
  });
  const { register, handleSubmit, formState, control, setValue, setError } = form;

  const goToDetails = () => {
    if (!slot) return;
    setValue("showroomId", showroomId);
    setValue("demoCarId", demoCarId);
    setValue("slotStart", slot.start);
    setStep(3);
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await postJson<TestDriveCreated>("/api/test-drives", values);
      try {
        sessionStorage.setItem(CONFIRMATION_KEY(res.reference), JSON.stringify(res));
      } catch {
        /* storage unavailable: the confirmation page falls back to server data */
      }
      router.push(`/test-drive/confirmed?ref=${encodeURIComponent(res.reference)}`);
    } catch (e) {
      if (e instanceof ApiClientError && (e.code === "SLOT_TAKEN" || e.code === "SLOT_INVALID")) {
        setSlot(null);
        setNotice(te(e.code));
        setReloadKey((k) => k + 1);
        setStep(2);
        return;
      }
      if (e instanceof ApiClientError && e.fields) {
        for (const [k, msg] of Object.entries(e.fields)) setError(k as keyof In, { message: msg });
      }
      setServerError(te(errorKey(e) as "generic"));
    }
  });

  const steps = [t("stepCar"), t("stepTime"), t("stepDetails")];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {/* Stepper */}
        <ol className="mb-8 flex items-center gap-2" aria-label={t("stepOf", { current: step, total: 3 })}>
          {steps.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <li key={label} className="flex flex-1 items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
                    state === "done" && "bg-foreground text-background",
                    state === "current" && "bg-primary text-primary-foreground",
                    state === "todo" && "border border-border bg-card text-muted-foreground",
                  )}
                >
                  {state === "done" ? <CheckIcon className="size-4" aria-hidden="true" /> : n}
                </span>
                <span className={cn("hidden text-sm sm:inline", state === "current" ? "font-semibold" : "text-muted-foreground")}>
                  {label}
                </span>
                {n < 3 && <span className="h-px flex-1 bg-border" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        <h2 ref={headingRef} tabIndex={-1} className="mb-6 font-heading text-2xl font-semibold outline-none">
          <span className="block text-sm font-normal text-muted-foreground">
            {t("stepOf", { current: step, total: 3 })}
          </span>
          {steps[step - 1]}
        </h2>

        {step === 1 && (
          <div className="space-y-8">
            <fieldset>
              <legend className="mb-3 text-sm font-medium">{t("chooseShowroom")}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {showrooms.map((s) => (
                  <ChoiceCard
                    key={s.id}
                    name="showroom"
                    checked={s.id === showroomId}
                    onSelect={() => {
                      setShowroomId(s.id);
                      // keep the same model/variant if this showroom has it
                      const same = s.demoCars.find((d) => d.variantId === car?.variantId);
                      setDemoCarId(same?.id ?? "");
                      setSlot(null);
                    }}
                  >
                    <span className="font-semibold">{s.name}</span>
                    <span className="flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPinIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                      {s.address}
                    </span>
                  </ChoiceCard>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 text-sm font-medium">{t("chooseCar")}</legend>
              {!showroom || showroom.demoCars.length === 0 ? (
                <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("noDemoCars")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {showroom.demoCars.map((d) => (
                    <ChoiceCard
                      key={d.id}
                      name="car"
                      checked={d.id === demoCarId}
                      onSelect={() => {
                        setDemoCarId(d.id);
                        setSlot(null);
                      }}
                      className="flex-row items-center gap-3"
                    >
                      <span className="w-20 shrink-0">
                        <CarImage src={d.image} alt="" sizes="80px" />
                      </span>
                      <span className="text-sm font-semibold">{carName(d)}</span>
                    </ChoiceCard>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="flex justify-end">
              <Button size="lg" disabled={!showroom || !car} onClick={() => setStep(2)} className="w-full sm:w-auto">
                {tc("next")}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            {notice && <FormAlert message={notice} />}
            <fieldset>
              <legend className="mb-3 text-sm font-medium">{t("date")}</legend>
              <div className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0">
                {days.map((d, i) => {
                  const selected = d === date;
                  const noon = new Date(`${d}T12:00:00+05:30`);
                  return (
                    <label
                      key={d}
                      className={cn(
                        "relative flex w-16 shrink-0 cursor-pointer snap-start flex-col items-center rounded-xl border py-2 text-center transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        selected ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:bg-accent",
                      )}
                    >
                      <input
                        type="radio"
                        name="date"
                        value={d}
                        checked={selected}
                        onChange={() => {
                          setDate(d);
                          setSlot(null);
                          setNotice(null);
                        }}
                        className="sr-only"
                      />
                      <span className="text-[0.6875rem] uppercase">
                        {i === 0 ? t("today") : i === 1 ? t("tomorrow") : formatDateIST(noon, locale, { weekday: "short" })}
                      </span>
                      <span className="text-lg font-semibold">{formatDateIST(noon, locale, { day: "numeric" })}</span>
                      <span className="text-[0.6875rem]">{formatDateIST(noon, locale, { month: "short" })}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset aria-busy={slots === null && !slotsError}>
              <legend className="mb-3 text-sm font-medium">{t("chooseSlot")}</legend>
              {slotsError ? (
                <div className="flex items-center gap-3 rounded-xl bg-destructive-soft p-4 text-sm text-destructive" role="alert">
                  {t("slotsError")}
                  <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
                    <RotateCwIcon aria-hidden="true" /> {tc("retry")}
                  </Button>
                </div>
              ) : slots === null ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" aria-label={t("slotsLoading")}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <Skeleton key={i} className="h-11 rounded-lg" />
                  ))}
                  <span className="sr-only">{t("slotsLoading")}</span>
                </div>
              ) : slots.every((s) => !s.available) ? (
                <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("noSlots")}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {slots.map((s) => {
                    const selected = slot?.start === s.start;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        disabled={!s.available}
                        aria-pressed={selected}
                        aria-label={s.available ? s.label : t("slotTakenLabel", { time: s.label })}
                        onClick={() => {
                          setSlot(s);
                          setNotice(null);
                        }}
                        className={cn(
                          "tabular h-11 rounded-lg border text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          selected && "border-primary bg-primary text-primary-foreground",
                          !selected && s.available && "border-border bg-card hover:border-primary",
                          !s.available && "cursor-not-allowed border-transparent bg-muted text-muted-foreground/60 line-through",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <Button variant="ghost" size="lg" onClick={() => setStep(1)}>
                <ChevronLeftIcon aria-hidden="true" /> {tc("back")}
              </Button>
              <Button size="lg" disabled={!slot} onClick={goToDetails}>
                {tc("next")}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={onSubmit} noValidate className="max-w-lg space-y-4">
            <TextField label={tf("name")} autoComplete="name" error={fieldError("name", formState.errors.name)} {...register("name")} />
            <TextField
              label={tf("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              hint={tf("phoneHint")}
              error={fieldError("phone", formState.errors.phone)}
              {...register("phone")}
            />
            <TextField
              label={tf("email")}
              type="email"
              optional
              autoComplete="email"
              error={fieldError("email", formState.errors.email)}
              {...register("email")}
            />
            <ConsentField control={control} name="consent" error={fieldError("consent", formState.errors.consent)} />
            <FormAlert message={serverError} />
            <div className="flex flex-col-reverse justify-between gap-3 pt-2 sm:flex-row">
              <Button type="button" variant="ghost" size="lg" onClick={() => setStep(2)}>
                <ChevronLeftIcon aria-hidden="true" /> {tc("back")}
              </Button>
              <Button type="submit" size="lg" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? (
                  <>
                    <Loader2Icon className="animate-spin" aria-hidden="true" /> {t("submitting")}
                  </>
                ) : (
                  t("submit")
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Summary */}
      <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-soft lg:sticky lg:top-24">
        <h2 className="mb-4 font-heading text-lg font-semibold">{t("summary")}</h2>
        {car && (
          <div className="mb-4 rounded-xl bg-muted/60 px-4 pt-2">
            <CarImage src={car.image} alt="" sizes="300px" />
          </div>
        )}
        <dl className="space-y-3 text-sm">
          <SummaryRow label={t("where")} value={showroom?.name} />
          <SummaryRow label={t("car")} value={car ? carName(car) : undefined} />
          <SummaryRow
            label={t("when")}
            value={slot ? `${formatDateTimeIST(slot.start, locale)} · ${t("duration", { minutes: SLOT_MINUTES })}` : undefined}
          />
        </dl>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function ChoiceCard({
  name,
  checked,
  onSelect,
  children,
  className,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col gap-1 rounded-xl border bg-card p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/30",
        className,
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {children}
      {checked && (
        <CheckIcon className="absolute top-3 right-3 size-4 text-primary" aria-hidden="true" />
      )}
    </label>
  );
}
