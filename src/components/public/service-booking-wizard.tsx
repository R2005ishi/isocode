"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon, ChevronLeftIcon, ClockIcon, Loader2Icon, MapPinIcon, RotateCwIcon, WrenchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateIST, formatDateTimeIST, isoDateIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  SERVICE_BOOKING_WINDOW_DAYS,
  SERVICE_SLOT_MINUTES,
  SERVICE_TYPES,
  ServiceBookingCreateSchema,
  type PublicWorkshop,
  type ServiceBookingCreate,
  type ServiceBookingCreated,
  type ServiceBookingInput,
  type ServiceSlot,
} from "@/server/services/service-slots";
import { ApiClientError, errorKey, getJson, postJson } from "./api";
import { ConsentField, FieldMessage, FormAlert, TextField, useFieldError } from "./form-fields";
import { NativeSelect } from "./native-select";

type In = ServiceBookingCreate;
type Out = ServiceBookingInput;

/** Field names whose (English) schema messages are replaced by translated `service.errors.*`. */
const SERVICE_FIELDS = new Set(["registration", "modelName", "serviceType", "odometerKm", "notes"]);

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function ServiceBookingWizard({
  workshops,
  initialWorkshopId,
}: {
  workshops: PublicWorkshop[];
  initialWorkshopId?: string;
}) {
  const t = useTranslations("service");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const baseFieldError = useFieldError();
  const fieldError = (field: string, err?: { message?: string }) => {
    if (!err) return undefined;
    return SERVICE_FIELDS.has(field) ? t(`errors.${field}` as "errors.registration") : baseFieldError(field, err);
  };

  const [step, setStep] = useState(1);
  const [workshopId, setWorkshopId] = useState(initialWorkshopId ?? workshops[0]?.id ?? "");
  const [date, setDate] = useState(() => isoDateIST(0));
  const [slot, setSlot] = useState<ServiceSlot | null>(null);
  const [slots, setSlots] = useState<ServiceSlot[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const workshop = workshops.find((w) => w.id === workshopId);

  const days = useMemo(
    () => Array.from({ length: SERVICE_BOOKING_WINDOW_DAYS + 1 }, (_, i) => isoDateIST(i)),
    [],
  );

  // Live bay availability whenever the workshop or date changes (or after a full-slot conflict).
  useEffect(() => {
    if (step !== 2 || !workshopId) return;
    const ctrl = new AbortController();
    setSlots(null);
    setSlotsError(false);
    const qs = new URLSearchParams({ workshopId, date });
    getJson<ServiceSlot[]>(`/api/service-slots?${qs}`, ctrl.signal)
      .then(setSlots)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setSlotsError(true);
      });
    return () => ctrl.abort();
  }, [step, workshopId, date, reloadKey]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(ServiceBookingCreateSchema),
    defaultValues: {
      workshopId: "",
      slotStart: "",
      name: "",
      phone: "",
      email: "",
      registration: "",
      modelName: "",
      serviceType: "PERIODIC",
      odometerKm: "",
      notes: "",
      locale: locale === "hi" ? "hi" : "en",
      consent: false as unknown as true, // DPDP: unticked by default
    },
  });
  const { register, handleSubmit, formState, control, setValue, setError, watch } = form;
  const serviceType = watch("serviceType");
  const registration = watch("registration");
  const modelName = watch("modelName");

  const goToDetails = () => {
    if (!slot) return;
    setValue("workshopId", workshopId);
    setValue("slotStart", slot.start);
    setStep(3);
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await postJson<ServiceBookingCreated>("/api/service-bookings", values);
      router.push(`/service/confirmed?ref=${encodeURIComponent(res.reference)}`);
    } catch (e) {
      if (e instanceof ApiClientError && (e.code === "SLOT_TAKEN" || e.code === "SLOT_INVALID")) {
        setSlot(null);
        setNotice(e.code === "SLOT_TAKEN" ? t("errors.full") : t("errors.invalid"));
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

  const steps = [t("stepWorkshop"), t("stepTime"), t("stepDetails")];
  const isTypeKey = (v: unknown): v is (typeof SERVICE_TYPES)[number] =>
    SERVICE_TYPES.includes(v as (typeof SERVICE_TYPES)[number]);

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
              <legend className="mb-3 text-sm font-medium">{t("chooseWorkshop")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {workshops.map((w) => (
                  <ChoiceCard
                    key={w.id}
                    name="workshop"
                    checked={w.id === workshopId}
                    onSelect={() => {
                      setWorkshopId(w.id);
                      setSlot(null);
                      setNotice(null);
                    }}
                  >
                    <span className="pr-6 font-semibold">{w.name}</span>
                    {w.address && (
                      <span className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPinIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        {w.address}
                      </span>
                    )}
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <WrenchIcon className="size-3 shrink-0" aria-hidden="true" />
                        {t("bays", { count: w.bays })}
                      </span>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
                        {t("hours", { open: hourLabel(w.openHour), close: hourLabel(w.closeHour) })}
                      </span>
                    </span>
                  </ChoiceCard>
                ))}
              </div>
            </fieldset>

            <div className="flex justify-end">
              <Button size="lg" disabled={!workshop} onClick={() => setStep(2)} className="w-full sm:w-auto">
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-label={t("slotsLoading")}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                  <span className="sr-only">{t("slotsLoading")}</span>
                </div>
              ) : slots.every((s) => !s.available) ? (
                <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("noSlots")}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {slots.map((s) => {
                    const selected = slot?.start === s.start;
                    const low = s.available && s.remaining <= Math.max(1, Math.floor(s.capacity / 4));
                    return (
                      <button
                        key={s.start}
                        type="button"
                        disabled={!s.available}
                        aria-pressed={selected}
                        aria-label={
                          s.available
                            ? t("slotFreeLabel", { time: s.label, free: s.remaining, total: s.capacity })
                            : t("slotFullLabel", { time: s.label })
                        }
                        onClick={() => {
                          setSlot(s);
                          setNotice(null);
                        }}
                        className={cn(
                          "flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          selected && "border-primary bg-primary text-primary-foreground",
                          !selected && s.available && "border-border bg-card hover:border-primary",
                          !s.available && "cursor-not-allowed border-transparent bg-muted text-muted-foreground/60",
                        )}
                      >
                        <span className={cn("tabular font-semibold", !s.available && "line-through")}>{s.label}</span>
                        <span
                          className={cn(
                            "text-xs",
                            selected ? "text-primary-foreground/90" : low ? "font-medium text-destructive" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        >
                          {s.available ? t("baysFree", { free: s.remaining, total: s.capacity }) : t("slotFull")}
                        </span>
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
            <TextField
              label={t("registration")}
              autoCapitalize="characters"
              autoComplete="off"
              hint={t("registrationHint")}
              error={fieldError("registration", formState.errors.registration)}
              {...register("registration")}
            />
            <TextField
              label={t("modelName")}
              placeholder={t("modelNamePlaceholder")}
              error={fieldError("modelName", formState.errors.modelName)}
              {...register("modelName")}
            />
            <div className="space-y-1.5">
              <Label htmlFor="svc-type">{t("serviceType")}</Label>
              <NativeSelect
                id="svc-type"
                aria-invalid={!!formState.errors.serviceType}
                aria-describedby={formState.errors.serviceType ? "svc-type-err" : undefined}
                {...register("serviceType")}
              >
                {SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {t(`serviceTypes.${st}`)}
                  </option>
                ))}
              </NativeSelect>
              <FieldMessage id="svc-type-err" message={fieldError("serviceType", formState.errors.serviceType)} />
            </div>
            <TextField
              label={t("odometer")}
              inputMode="numeric"
              optional
              autoComplete="off"
              hint={t("odometerHint")}
              error={fieldError("odometerKm", formState.errors.odometerKm)}
              {...register("odometerKm")}
            />
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
            <div className="space-y-1.5">
              <Label htmlFor="svc-notes">
                {t("notes")} <span className="font-normal text-muted-foreground">({tc("optional")})</span>
              </Label>
              <Textarea
                id="svc-notes"
                rows={3}
                maxLength={500}
                placeholder={t("notesPlaceholder")}
                aria-invalid={!!formState.errors.notes}
                aria-describedby={formState.errors.notes ? "svc-notes-err" : undefined}
                {...register("notes")}
              />
              <FieldMessage id="svc-notes-err" message={fieldError("notes", formState.errors.notes)} />
            </div>
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
        <dl className="space-y-3 text-sm">
          <SummaryRow label={t("where")} value={workshop?.name} />
          <SummaryRow
            label={t("when")}
            value={slot ? `${formatDateTimeIST(slot.start, locale)} · ${t("duration", { minutes: SERVICE_SLOT_MINUTES })}` : undefined}
          />
          {step === 3 && (
            <>
              <SummaryRow label={t("service")} value={isTypeKey(serviceType) ? t(`serviceTypes.${serviceType}`) : undefined} />
              <SummaryRow
                label={t("vehicle")}
                value={[modelName, registration?.toUpperCase()].filter(Boolean).join(" · ") || undefined}
              />
            </>
          )}
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
        "relative flex cursor-pointer flex-col gap-1.5 rounded-xl border bg-card p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/30",
        className,
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {children}
      {checked && <CheckIcon className="absolute top-3 right-3 size-4 text-primary" aria-hidden="true" />}
    </label>
  );
}
