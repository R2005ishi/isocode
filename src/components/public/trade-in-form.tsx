"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2Icon, InfoIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatINR, formatNumberIN } from "@/lib/format";
import {
  currentYearIST,
  TRADE_IN_CONDITIONS,
  TRADE_IN_FUELS,
  TRADE_IN_MIN_YEAR,
  TradeInCreateSchema,
  type TradeInCreate,
  type TradeInCreated,
  type TradeInCreateInput,
} from "@/server/workflows/trade-in.schema";
import { ApiClientError, errorKey, postJson } from "./api";
import { ConsentField, FieldMessage, FormAlert, TextField, useFieldError } from "./form-fields";
import { NativeSelect } from "./native-select";

type In = TradeInCreate;
type Out = TradeInCreateInput;

export type TradeInFormOptions = {
  showrooms: { id: string; name: string; address: string }[];
  models: { id: string; name: string; slug: string; variants: { id: string; name: string }[] }[];
};

/** Fields whose error text comes from the shared `form.errors` namespace. */
const SHARED_FIELDS = new Set(["name", "phone", "email", "consent", "message"]);
const OWN_FIELDS = new Set([
  "make",
  "modelName",
  "variantName",
  "year",
  "km",
  "owners",
  "fuel",
  "registration",
  "expectedPrice",
  "condition",
  "interestModelId",
  "interestVariantId",
  "showroomId",
]);

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[,\s₹]/g, "");
  if (!s || !/^\d+$/.test(s)) return null;
  return Number(s);
}

/** Buyer trade-in request: current car + optional car of interest + contact, POSTs /api/trade-in. */
export function TradeInForm({
  options,
  initialModelId,
  initialVariantId,
  citySlug,
}: {
  options: TradeInFormOptions;
  initialModelId?: string;
  initialVariantId?: string;
  citySlug?: string;
}) {
  const t = useTranslations("tradeIn");
  const tf = useTranslations("form");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const locale = useLocale();
  const sharedError = useFieldError();
  const uid = useId();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<TradeInCreated | null>(null);

  const maxYear = currentYearIST();
  const years = useMemo(
    () => Array.from({ length: maxYear - TRADE_IN_MIN_YEAR + 1 }, (_, i) => maxYear - i),
    [maxYear],
  );

  const defaultValues: In = {
    make: "",
    modelName: "",
    variantName: "",
    year: "",
    km: "",
    owners: "1",
    fuel: "",
    registration: "",
    expectedPrice: "",
    condition: "",
    interestModelId: initialModelId ?? "",
    interestVariantId: initialVariantId ?? "",
    showroomId: "",
    citySlug: citySlug ?? "",
    name: "",
    phone: "",
    email: "",
    message: "",
    locale: locale === "hi" ? "hi" : "en",
    // DPDP: unticked by default. Cast because the schema only accepts literal `true`.
    consent: false as unknown as true,
  };

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(TradeInCreateSchema),
    defaultValues,
  });
  const { register, handleSubmit, formState, setError, control, reset, watch, setValue } = form;
  const errors = formState.errors;

  const fieldError = (field: string, err?: FieldError | { message?: string }) => {
    if (!err) return undefined;
    if (SHARED_FIELDS.has(field)) return sharedError(field, err);
    if (field === "year") return t("errors.year", { min: TRADE_IN_MIN_YEAR, max: maxYear });
    if (OWN_FIELDS.has(field)) return t(`errors.${field}` as "errors.make");
    return err.message;
  };

  const interestModelId = watch("interestModelId");
  const selectedModel = options.models.find((m) => m.id === interestModelId);
  const kmValue = toNumber(watch("km"));
  const priceValue = toNumber(watch("expectedPrice"));

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await postJson<TradeInCreated>("/api/trade-in", values);
      setDone(res);
      toast.success(t("toast", { reference: res.reference }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) {
        for (const [k, msg] of Object.entries(e.fields)) setError(k as keyof In, { message: msg });
      }
      setServerError(te(errorKey(e) as "generic"));
    }
  });

  if (done) {
    return (
      <div
        className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-soft"
        aria-live="polite"
      >
        <CheckCircle2Icon className="size-12 text-success" aria-hidden="true" />
        <h2 className="display text-2xl font-semibold">{t("successTitle")}</h2>
        <p>{t("successBody", { reference: done.reference })}</p>
        <p className="font-mono text-2xl font-semibold tracking-wider" aria-hidden="true">
          {done.reference}
        </p>
        <p className="text-sm text-muted-foreground">{t("successNext")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/cars">{t("browseCars")}</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setDone(null);
              reset(defaultValues);
            }}
          >
            {t("another")}
          </Button>
        </div>
      </div>
    );
  }

  const ids = {
    year: `${uid}-year`,
    owners: `${uid}-owners`,
    fuel: `${uid}-fuel`,
    condition: `${uid}-condition`,
    model: `${uid}-model`,
    variant: `${uid}-variant`,
    showroom: `${uid}-showroom`,
    message: `${uid}-message`,
  };
  const optional = <span className="font-normal text-muted-foreground">({tc("optional")})</span>;

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl space-y-8">
      {/* Current car */}
      <fieldset className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
        <legend className="px-1 font-heading text-lg font-semibold">{t("sections.car")}</legend>
        <p className="-mt-2 text-sm text-muted-foreground">{t("sections.carHint")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label={t("fields.make")}
            placeholder={t("fields.makePlaceholder")}
            autoComplete="off"
            error={fieldError("make", errors.make)}
            {...register("make")}
          />
          <TextField
            label={t("fields.model")}
            placeholder={t("fields.modelPlaceholder")}
            autoComplete="off"
            error={fieldError("modelName", errors.modelName)}
            {...register("modelName")}
          />
          <TextField
            label={t("fields.variant")}
            placeholder={t("fields.variantPlaceholder")}
            optional
            autoComplete="off"
            error={fieldError("variantName", errors.variantName)}
            {...register("variantName")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={ids.year}>{t("fields.year")}</Label>
            <NativeSelect id={ids.year} aria-invalid={!!errors.year} {...register("year")}>
              <option value="">{t("fields.yearPlaceholder")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
            <FieldMessage message={fieldError("year", errors.year)} />
          </div>
          <TextField
            label={t("fields.km")}
            placeholder={t("fields.kmPlaceholder")}
            inputMode="numeric"
            autoComplete="off"
            hint={kmValue !== null ? t("fields.kmPreview", { km: formatNumberIN(kmValue) }) : undefined}
            error={fieldError("km", errors.km)}
            {...register("km")}
          />
          <div className="space-y-1.5">
            <Label htmlFor={ids.owners}>{t("fields.owners")}</Label>
            <NativeSelect id={ids.owners} aria-invalid={!!errors.owners} {...register("owners")}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {t("fields.ownersOption", { count: n })}
                </option>
              ))}
              <option value={5}>{t("fields.ownersMore")}</option>
            </NativeSelect>
            <FieldMessage message={fieldError("owners", errors.owners)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={ids.fuel}>
              {t("fields.fuel")} {optional}
            </Label>
            <NativeSelect id={ids.fuel} aria-invalid={!!errors.fuel} {...register("fuel")}>
              <option value="">{t("fields.fuelAny")}</option>
              {TRADE_IN_FUELS.map((f) => (
                <option key={f} value={f}>
                  {t(`fuel.${f}`)}
                </option>
              ))}
            </NativeSelect>
            <FieldMessage message={fieldError("fuel", errors.fuel)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.condition}>
              {t("fields.condition")} {optional}
            </Label>
            <NativeSelect id={ids.condition} aria-invalid={!!errors.condition} {...register("condition")}>
              <option value="">{t("fields.conditionAny")}</option>
              {TRADE_IN_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`condition.${c}`)}
                </option>
              ))}
            </NativeSelect>
            <FieldMessage message={fieldError("condition", errors.condition)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("fields.registration")}
            placeholder={t("fields.registrationPlaceholder")}
            optional
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            hint={t("fields.registrationHint")}
            error={fieldError("registration", errors.registration)}
            {...register("registration")}
          />
          <TextField
            label={t("fields.expectedPrice")}
            placeholder={t("fields.expectedPricePlaceholder")}
            optional
            inputMode="numeric"
            autoComplete="off"
            hint={priceValue !== null ? formatINR(priceValue) : undefined}
            error={fieldError("expectedPrice", errors.expectedPrice)}
            {...register("expectedPrice")}
          />
        </div>
      </fieldset>

      {/* Car of interest */}
      <fieldset className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
        <legend className="px-1 font-heading text-lg font-semibold">{t("sections.interest")}</legend>
        <p className="-mt-2 text-sm text-muted-foreground">{t("sections.interestHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={ids.model}>
              {t("fields.interestModel")} {optional}
            </Label>
            <NativeSelect
              id={ids.model}
              aria-invalid={!!errors.interestModelId}
              {...register("interestModelId", {
                onChange: () => setValue("interestVariantId", ""),
              })}
            >
              <option value="">{t("fields.interestModelNone")}</option>
              {options.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
            <FieldMessage message={fieldError("interestModelId", errors.interestModelId)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.variant}>
              {t("fields.interestVariant")} {optional}
            </Label>
            <NativeSelect
              id={ids.variant}
              disabled={!selectedModel}
              aria-invalid={!!errors.interestVariantId}
              {...register("interestVariantId")}
            >
              <option value="">{t("fields.interestVariantAny")}</option>
              {selectedModel?.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </NativeSelect>
            <FieldMessage message={fieldError("interestVariantId", errors.interestVariantId)} />
          </div>
        </div>
      </fieldset>

      {/* Showroom + contact */}
      <fieldset className="space-y-4 rounded-2xl border bg-card p-5 md:p-6">
        <legend className="px-1 font-heading text-lg font-semibold">{t("sections.contact")}</legend>
        <div className="space-y-1.5">
          <Label htmlFor={ids.showroom}>
            {t("fields.showroom")} {optional}
          </Label>
          <NativeSelect id={ids.showroom} aria-invalid={!!errors.showroomId} {...register("showroomId")}>
            <option value="">{t("fields.showroomAny")}</option>
            {options.showrooms.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
          <FieldMessage message={fieldError("showroomId", errors.showroomId)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={tf("name")}
            autoComplete="name"
            error={fieldError("name", errors.name)}
            {...register("name")}
          />
          <TextField
            label={tf("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            hint={tf("phoneHint")}
            error={fieldError("phone", errors.phone)}
            {...register("phone")}
          />
        </div>
        <TextField
          label={tf("email")}
          type="email"
          optional
          autoComplete="email"
          error={fieldError("email", errors.email)}
          {...register("email")}
        />
        <div className="space-y-1.5">
          <Label htmlFor={ids.message}>
            {tf("message")} {optional}
          </Label>
          <Textarea
            id={ids.message}
            rows={3}
            placeholder={t("fields.messagePlaceholder")}
            aria-invalid={!!errors.message}
            {...register("message")}
          />
          <FieldMessage message={fieldError("message", errors.message)} />
        </div>
        <ConsentField control={control} name="consent" error={fieldError("consent", errors.consent)} />
      </fieldset>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("disclaimer")}
      </p>
      <FormAlert message={serverError} />
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? (
          <>
            <Loader2Icon className="animate-spin" aria-hidden="true" /> {tf("submitting")}
          </>
        ) : (
          t("submit")
        )}
      </Button>
    </form>
  );
}
