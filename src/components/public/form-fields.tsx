"use client";

import Link from "next/link";
import { useId } from "react";
import { Controller, type Control, type FieldError, type FieldValues, type Path } from "react-hook-form";
import { useTranslations } from "next-intl";
import { AlertCircleIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const TRANSLATED = new Set(["name", "phone", "email", "consent", "message"]);

/** Inline error text, translated by field name (contract schemas carry English messages). */
export function useFieldError() {
  const t = useTranslations("form.errors");
  return (field: string, err?: FieldError | { message?: string }) => {
    if (!err) return undefined;
    return TRANSLATED.has(field) ? t(field as "name") : err.message;
  };
}

export function TextField({
  label,
  error,
  hint,
  optional,
  className,
  ...input
}: React.ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}) {
  const id = useId();
  const t = useTranslations("common");
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">({t("optional")})</span>}
      </Label>
      <Input id={id} aria-invalid={!!error} aria-describedby={describedBy} {...input} />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldMessage id={`${id}-err`} message={error} />
    </div>
  );
}

export function FieldMessage({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-sm text-destructive">
      <AlertCircleIcon className="size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/** DPDP consent: unticked by default, links to the privacy notice. */
export function ConsentField<T extends FieldValues>({
  control,
  name,
  error,
}: {
  control: Control<T>;
  name: Path<T>;
  error?: string;
}) {
  const id = useId();
  const t = useTranslations("form");
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3">
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Checkbox
              id={id}
              className="mt-0.5 size-5"
              checked={field.value === true}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
              ref={field.ref}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-err` : undefined}
            />
          )}
        />
        <label htmlFor={id} className="text-sm leading-snug text-foreground/90">
          {t("consent")}{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-primary underline underline-offset-2">
            {t("consentLink")}
          </Link>
          .
        </label>
      </div>
      <FieldMessage id={`${id}-err`} message={error} />
    </div>
  );
}

export function FormAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
