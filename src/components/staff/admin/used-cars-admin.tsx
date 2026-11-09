"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CarIcon,
  ExternalLinkIcon,
  ImageIcon,
  LightbulbIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR, formatNumberIN } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AdminUsedCarSchema,
  FuelEnum,
  InspectionItemSchema,
  TransmissionEnum,
  UsedCarStatusEnum,
  type PriceBandResult,
} from "@/types/contracts";
import { api } from "../api";
import { FUEL_LABEL, TRANSMISSION_LABEL } from "../labels";
import { EmptyState, ErrorState, PageHeader } from "../states";
import { adminApi, ConfirmDialog, Field, useAdminList, useAdminMutation } from "./shared";
import type { AdminUsedCar, UsedCarStatus } from "./types";

const STATUS_STYLE: Record<UsedCarStatus, string> = {
  AVAILABLE: "bg-emerald-600",
  BOOKED: "bg-amber-500",
  SOLD: "bg-zinc-400",
};
const STATUS_TEXT: Record<UsedCarStatus, string> = { AVAILABLE: "Available", BOOKED: "Booked", SOLD: "Sold" };

export function UsedCarsAdmin({ isAdmin, isManager }: { isAdmin: boolean; isManager: boolean }) {
  const cars = useAdminList<AdminUsedCar>("used-cars");
  const [editing, setEditing] = useState<{ open: boolean; car: AdminUsedCar | null }>({ open: false, car: null });
  const [toDelete, setToDelete] = useState<AdminUsedCar | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | UsedCarStatus>("ALL");

  const setStatus = useAdminMutation(
    "used-cars",
    ({ car, status }: { car: AdminUsedCar; status: UsedCarStatus }) =>
      adminApi.update<AdminUsedCar>("used-cars", car.id, { status }),
    { success: (_r, v) => `${v.car.stockId} marked ${STATUS_TEXT[v.status].toLowerCase()}` },
  );
  const remove = useAdminMutation("used-cars", (car: AdminUsedCar) => adminApi.remove("used-cars", car.id), {
    success: (_r, car) => `${car.stockId} deleted`,
    onSuccess: () => setToDelete(null),
  });

  const list = (cars.data ?? []).filter((c) => statusFilter === "ALL" || c.status === statusFilter);
  const counts = UsedCarStatusEnum.options.map((s) => ({ s, n: (cars.data ?? []).filter((c) => c.status === s).length }));

  return (
    <div>
      <PageHeader
        title="Used stock"
        description={
          cars.data ? (
            <span>
              {counts.map(({ s, n }, i) => (
                <span key={s}>
                  {i > 0 && " · "}
                  {n} {STATUS_TEXT[s].toLowerCase()}
                </span>
              ))}
              {!isAdmin && " · Registration numbers are masked for your role."}
            </span>
          ) : (
            "Certified pre-owned cars listed on the site."
          )
        }
        actions={
          <Button onClick={() => setEditing({ open: true, car: null })}>
            <PlusIcon /> Add car
          </Button>
        }
      />
      <div className="mb-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger size="sm" className="min-w-40 bg-background" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {UsedCarStatusEnum.options.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_TEXT[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cars.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : cars.isError ? (
        <ErrorState error={cars.error} onRetry={() => cars.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CarIcon}
          title={statusFilter === "ALL" ? "No used cars in stock" : `No ${STATUS_TEXT[statusFilter].toLowerCase()} cars`}
          action={
            statusFilter === "ALL" ? (
              <Button onClick={() => setEditing({ open: true, car: null })}>
                <PlusIcon /> Add car
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStatusFilter("ALL")}>
                Show all
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <li key={c.id} className={cn("flex flex-col rounded-xl border bg-background", c.status === "SOLD" && "opacity-75")}>
              <div className="flex gap-3 p-4">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {c.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an arbitrary admin-entered path
                    <img src={c.images[0]} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {c.modelName} {c.variantName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{c.stockId}</p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{formatINR(c.price)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.year} · {formatNumberIN(c.km)} km · {c.owners} owner{c.owners > 1 ? "s" : ""} · {FUEL_LABEL[c.fuel]} ·{" "}
                    {TRANSMISSION_LABEL[c.transmission]}
                  </p>
                  <p className="mt-1 text-xs">
                    <span className="text-muted-foreground">Reg. </span>
                    <span className="font-mono">{isAdmin && c.registration ? c.registration : c.registrationMasked}</span>
                    {!isAdmin && <span className="text-muted-foreground"> (masked)</span>}
                  </p>
                </div>
              </div>
              {isManager && <PriceBand carId={c.id} price={c.price} />}
              <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t px-4 py-2.5">
                <Select
                  value={c.status}
                  onValueChange={(v) => v !== c.status && setStatus.mutate({ car: c, status: v as UsedCarStatus })}
                  disabled={setStatus.isPending && setStatus.variables?.car.id === c.id}
                >
                  <SelectTrigger size="sm" className="w-32" aria-label={`Status of ${c.stockId}`}>
                    <span className={cn("size-1.5 rounded-full", STATUS_STYLE[c.status])} aria-hidden />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UsedCarStatusEnum.options.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_TEXT[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {c.inspection.length} checks · {c.images.length} photos
                </span>
                <div className="ml-auto flex gap-1">
                  <Button asChild size="icon-sm" variant="ghost" aria-label={`Open public page for ${c.stockId}`}>
                    <a href={`/used/${c.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon />
                    </a>
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing({ open: true, car: c })} aria-label={`Edit ${c.stockId}`}>
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToDelete(c)}
                    aria-label={`Delete ${c.stockId}`}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing.open && (
        <UsedCarDialog car={editing.car} isAdmin={isAdmin} onClose={() => setEditing({ open: false, car: null })} />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.stockId ?? ""}?`}
        description="The car disappears from the site. This cannot be undone. Cars with leads can’t be deleted — mark them Sold instead."
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </div>
  );
}

/** Manager-only suggestion from past sales. Never shown to buyers or used to set the price automatically. */
function PriceBand({ carId, price }: { carId: string; price: number }) {
  const band = useQuery({
    queryKey: ["price-band", carId],
    queryFn: () => api<PriceBandResult>(`/api/used-cars/${carId}/price-band`),
    staleTime: 5 * 60_000,
  });
  return (
    <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
      <LightbulbIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {band.isPending ? (
        <Skeleton className="h-4 w-48" />
      ) : band.isError ? (
        <span className="text-muted-foreground">
          Suggested price band unavailable.{" "}
          <button type="button" className="underline" onClick={() => band.refetch()}>
            Retry
          </button>
        </span>
      ) : band.data.ok ? (
        <span>
          <span className="font-medium">Suggested price band:</span>{" "}
          <span className="tabular-nums">
            {formatINR(band.data.low)} – {formatINR(band.data.high)}
          </span>{" "}
          <span className="text-muted-foreground">
            (median {formatINR(band.data.median)}, {band.data.comparables} comparable sales)
          </span>
          {(price < band.data.low || price > band.data.high) && (
            <span className="mt-0.5 block text-amber-800 dark:text-amber-400">
              Asking price is {price < band.data.low ? "below" : "above"} the band.
            </span>
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">
          Not enough comparable sales to suggest a price ({band.data.comparables} found).
        </span>
      )}
    </div>
  );
}

// ─── Create / edit form ────────────────────────────────────────────────────
const RegistrationSchema = AdminUsedCarSchema.shape.registration;
const FormSchema = AdminUsedCarSchema.omit({ images: true, registration: true, inspection: true }).extend({
  registration: z.string(),
  images: z.array(z.object({ url: z.string().trim().min(1, "Enter a path or remove the row").max(300) })).max(12),
  inspection: z.array(InspectionItemSchema.extend({ note: z.string().trim().max(200) })).max(30),
});
type Form = z.input<typeof FormSchema>;

function UsedCarDialog({ car, isAdmin, onClose }: { car: AdminUsedCar | null; isAdmin: boolean; onClose: () => void }) {
  // Non-admins never receive the full registration, so on edit they may only replace it.
  const regOptional = !!car && !isAdmin;
  const form = useForm<Form>({
    resolver: zodResolver(
      FormSchema.superRefine((v, ctx) => {
        const reg = v.registration.trim();
        if (!reg && regOptional) return;
        const r = RegistrationSchema.safeParse(reg);
        if (!r.success) ctx.addIssue({ code: "custom", path: ["registration"], message: reg ? r.error.issues[0].message : "Required" });
      }),
    ),
    defaultValues: car
      ? {
          stockId: car.stockId,
          slug: car.slug,
          modelName: car.modelName,
          variantName: car.variantName,
          fuel: car.fuel,
          transmission: car.transmission,
          year: car.year,
          km: car.km,
          owners: car.owners,
          price: car.price,
          status: car.status,
          registration: isAdmin ? (car.registration ?? "") : "",
          colour: car.colour ?? "",
          images: car.images.map((url) => ({ url })),
          inspection: car.inspection.map((i) => ({ item: i.item, result: i.result, note: i.note ?? "" })),
        }
      : {
          stockId: "",
          slug: "",
          modelName: "",
          variantName: "",
          fuel: "PETROL",
          transmission: "MANUAL",
          year: new Date().getFullYear() - 3,
          km: undefined as unknown as number,
          owners: 1,
          price: undefined as unknown as number,
          status: "AVAILABLE",
          registration: "",
          colour: "",
          images: [],
          inspection: ["Engine", "Brakes", "Tyres", "Suspension", "Electricals", "Body & paint"].map((item) => ({
            item,
            result: "OK" as const,
            note: "",
          })),
        },
  });
  const images = useFieldArray({ control: form.control, name: "images" });
  const inspection = useFieldArray({ control: form.control, name: "inspection" });
  const errs = form.formState.errors;

  const save = useAdminMutation(
    "used-cars",
    (v: Form) => {
      const body: Record<string, unknown> = {
        ...v,
        colour: v.colour?.trim() ? v.colour : undefined,
        images: v.images.map((i) => i.url.trim()),
        inspection: v.inspection.map((i) => ({ item: i.item, result: i.result, ...(i.note.trim() ? { note: i.note } : {}) })),
      };
      if (!v.registration.trim()) delete body.registration;
      return car ? adminApi.update<AdminUsedCar>("used-cars", car.id, body) : adminApi.create<AdminUsedCar>("used-cars", body);
    },
    { success: (r) => `${(r as AdminUsedCar).stockId} saved`, onSuccess: onClose, form },
  );

  const autoSlug = () => {
    if (car || form.formState.dirtyFields.slug) return;
    const v = form.getValues();
    const s = [v.stockId, v.modelName, v.variantName, v.fuel, v.year]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    form.setValue("slug", s);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{car ? `Edit ${car.stockId}` : "Add used car"}</DialogTitle>
          <DialogDescription>The registration number is never shown in full on the public site.</DialogDescription>
        </DialogHeader>
        <form id="used-car-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-6" noValidate>
          <Field form={form} name="stockId" label="Stock ID" className="sm:col-span-2">
            <Input id="stockId" className="font-mono" placeholder="UC-1200" {...form.register("stockId", { onBlur: autoSlug })} />
          </Field>
          <Field form={form} name="modelName" label="Model" className="sm:col-span-2">
            <Input id="modelName" placeholder="Model C" {...form.register("modelName", { onBlur: autoSlug })} />
          </Field>
          <Field form={form} name="variantName" label="Variant" className="sm:col-span-2">
            <Input id="variantName" placeholder="VX Diesel" {...form.register("variantName", { onBlur: autoSlug })} />
          </Field>
          <Field form={form} name="slug" label="URL slug" className="sm:col-span-6">
            <Input id="slug" className="font-mono" {...form.register("slug")} />
          </Field>
          <Field form={form} name="fuel" label="Fuel" className="sm:col-span-2">
            <Select value={form.watch("fuel")} onValueChange={(v) => form.setValue("fuel", v as Form["fuel"])}>
              <SelectTrigger id="fuel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FuelEnum.options.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FUEL_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field form={form} name="transmission" label="Gearbox" className="sm:col-span-2">
            <Select value={form.watch("transmission")} onValueChange={(v) => form.setValue("transmission", v as Form["transmission"])}>
              <SelectTrigger id="transmission" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TransmissionEnum.options.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSMISSION_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field form={form} name="status" label="Status" className="sm:col-span-2">
            <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as UsedCarStatus)}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UsedCarStatusEnum.options.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_TEXT[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field form={form} name="year" label="Year" className="sm:col-span-2">
            <Input id="year" type="number" inputMode="numeric" {...form.register("year", { valueAsNumber: true, onBlur: autoSlug })} />
          </Field>
          <Field form={form} name="km" label="Kilometres" className="sm:col-span-2">
            <Input id="km" type="number" inputMode="numeric" {...form.register("km", { valueAsNumber: true })} />
          </Field>
          <Field form={form} name="owners" label="Owners" className="sm:col-span-2">
            <Input id="owners" type="number" inputMode="numeric" min={1} max={10} {...form.register("owners", { valueAsNumber: true })} />
          </Field>
          <Field form={form} name="price" label="Asking price (₹)" className="sm:col-span-2">
            <Input id="price" type="number" inputMode="numeric" step={1000} {...form.register("price", { valueAsNumber: true })} />
          </Field>
          <Field
            form={form}
            name="registration"
            label="Registration number"
            className="sm:col-span-2"
            hint={regOptional ? `Current: ${car?.registrationMasked}. Leave blank to keep it.` : "e.g. UP32 AB 1234"}
          >
            <Input
              id="registration"
              className="font-mono uppercase"
              autoComplete="off"
              placeholder={regOptional ? car?.registrationMasked : "UP32 AB 1234"}
              {...form.register("registration")}
            />
          </Field>
          <Field form={form} name="colour" label="Colour" className="sm:col-span-2">
            <Input id="colour" {...form.register("colour")} />
          </Field>

          <fieldset className="space-y-2 sm:col-span-6">
            <legend className="text-sm font-medium">Photos</legend>
            <p className="text-xs text-muted-foreground">Image paths or URLs, first one is the cover. Up to 12.</p>
            {images.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input
                  aria-label={`Photo ${i + 1}`}
                  className="font-mono text-xs"
                  placeholder="/cars/model-c.svg"
                  aria-invalid={!!errs.images?.[i]?.url}
                  {...form.register(`images.${i}.url`)}
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => images.remove(i)} aria-label={`Remove photo ${i + 1}`}>
                  <XIcon />
                </Button>
              </div>
            ))}
            {errs.images && <p className="text-xs text-destructive">Fill in or remove empty photo rows.</p>}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="-ml-2"
              disabled={images.fields.length >= 12}
              onClick={() => images.append({ url: "" })}
            >
              <PlusIcon /> Add photo
            </Button>
          </fieldset>

          <fieldset className="space-y-2 sm:col-span-6">
            <legend className="text-sm font-medium">Inspection report</legend>
            {inspection.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_7.5rem_auto] gap-2 sm:grid-cols-[10rem_8rem_1fr_auto]">
                <Input
                  aria-label={`Check ${i + 1} name`}
                  placeholder="Brakes"
                  aria-invalid={!!errs.inspection?.[i]?.item}
                  {...form.register(`inspection.${i}.item`)}
                />
                <Select
                  value={form.watch(`inspection.${i}.result`)}
                  onValueChange={(v) => form.setValue(`inspection.${i}.result`, v as "OK" | "ATTENTION" | "REPLACED")}
                >
                  <SelectTrigger aria-label={`Check ${i + 1} result`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OK">OK</SelectItem>
                    <SelectItem value="ATTENTION">Attention</SelectItem>
                    <SelectItem value="REPLACED">Replaced</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  aria-label={`Check ${i + 1} note`}
                  placeholder="Note (optional)"
                  className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
                  {...form.register(`inspection.${i}.note`)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto"
                  onClick={() => inspection.remove(i)}
                  aria-label={`Remove check ${i + 1}`}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            {errs.inspection && <p className="text-xs text-destructive">Every check needs a name.</p>}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="-ml-2"
              disabled={inspection.fields.length >= 30}
              onClick={() => inspection.append({ item: "", result: "OK", note: "" })}
            >
              <PlusIcon /> Add check
            </Button>
          </fieldset>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="used-car-form" disabled={save.isPending}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            {car ? "Save changes" : "Add car"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
