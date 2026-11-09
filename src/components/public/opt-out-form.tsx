"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useTranslations } from "next-intl";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maskPhone } from "@/server/services/mask";
import { OptOutSchema } from "@/types/contracts";
import { errorKey, postJson } from "./api";
import { FormAlert, TextField, useFieldError } from "./form-fields";

type In = z.input<typeof OptOutSchema>;
type Out = z.output<typeof OptOutSchema>;

export function OptOutForm() {
  const t = useTranslations("optOut");
  const tf = useTranslations("form");
  const te = useTranslations("errors");
  const fieldError = useFieldError();
  const [done, setDone] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState, reset } = useForm<In, unknown, Out>({
    resolver: zodResolver(OptOutSchema),
    defaultValues: { phone: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await postJson<{ ok: true }>("/api/optout", values);
      setDone(values.phone);
    } catch (e) {
      setServerError(te(errorKey(e) as "generic"));
    }
  });

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <CheckCircle2Icon className="mb-3 size-10 text-success" aria-hidden="true" />
        <h2 className="font-heading text-xl font-semibold">{t("successTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("successBody", { phone: maskPhone(done) })}</p>
        <Button
          variant="outline"
          className="mt-5"
          onClick={() => {
            reset();
            setDone(null);
          }}
        >
          {t("another")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <TextField
        label={tf("phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        hint={tf("phoneHint")}
        error={fieldError("phone", formState.errors.phone)}
        {...register("phone")}
      />
      <FormAlert message={serverError} />
      <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? (
          <>
            <Loader2Icon className="animate-spin" aria-hidden="true" /> {t("submitting")}
          </>
        ) : (
          t("submit")
        )}
      </Button>
    </form>
  );
}
