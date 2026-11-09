"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LeadCreateSchema, type LeadCreated } from "@/types/contracts";
import { ApiClientError, errorKey, postJson } from "./api";
import { ConsentField, FieldMessage, FormAlert, TextField, useFieldError } from "./form-fields";

type In = z.input<typeof LeadCreateSchema>;
type Out = z.output<typeof LeadCreateSchema>;

export type EnquiryInterest = {
  interestModelId?: string;
  interestVariantId?: string;
  interestUsedCarId?: string;
  citySlug?: string;
};

/** "Enquire" — a dialog form that POSTs /api/leads. */
export function EnquiryDialog({
  itemLabel,
  interest,
  triggerLabel,
  triggerVariant = "outline",
  triggerSize = "lg",
  triggerClassName,
}: {
  itemLabel: string;
  interest: EnquiryInterest;
  triggerLabel: string;
  triggerVariant?: "default" | "outline" | "secondary";
  triggerSize?: "default" | "lg";
  triggerClassName?: string;
}) {
  const t = useTranslations("enquiry");
  const tf = useTranslations("form");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const locale = useLocale();
  const fieldError = useFieldError();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<LeadCreated | null>(null);

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(LeadCreateSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      message: "",
      locale: locale === "hi" ? "hi" : "en",
      // DPDP: unticked by default. Cast because the schema only accepts literal `true`.
      consent: false as unknown as true,
      ...interest,
    },
  });
  const { register, handleSubmit, formState, setError, control, reset } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await postJson<LeadCreated>("/api/leads", { ...values, message: values.message || undefined });
      setDone(res);
      toast.success(t("toast", { reference: res.reference }));
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) {
        for (const [k, msg] of Object.entries(e.fields)) setError(k as keyof In, { message: msg });
      }
      setServerError(te(errorKey(e) as "generic"));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v && done) {
          setDone(null);
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center" aria-live="polite">
            <CheckCircle2Icon className="size-12 text-success" aria-hidden="true" />
            <DialogTitle className="display text-2xl">{t("successTitle")}</DialogTitle>
            <DialogDescription>{t("successBody", { reference: done.reference })}</DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="display text-2xl">{t("title", { item: itemLabel })}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
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
              <TextField
                label={tf("email")}
                type="email"
                optional
                autoComplete="email"
                error={fieldError("email", errors.email)}
                {...register("email")}
              />
              <div className="space-y-1.5">
                <Label htmlFor="enq-message">
                  {tf("message")} <span className="font-normal text-muted-foreground">({tc("optional")})</span>
                </Label>
                <Textarea
                  id="enq-message"
                  rows={3}
                  placeholder={tf("messagePlaceholder")}
                  aria-invalid={!!errors.message}
                  {...register("message")}
                />
                <FieldMessage message={fieldError("message", errors.message)} />
              </div>
              <ConsentField control={control} name="consent" error={fieldError("consent", errors.consent)} />
              <FormAlert message={serverError} />
              <Button type="submit" size="lg" className="w-full" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? (
                  <>
                    <Loader2Icon className="animate-spin" aria-hidden="true" /> {tf("submitting")}
                  </>
                ) : (
                  t("submit")
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
