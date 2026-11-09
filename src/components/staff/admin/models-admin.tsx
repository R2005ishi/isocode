"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CarFrontIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AdminModelSchema,
  AdminVariantSchema,
  ColourSchema,
  FuelEnum,
  TransmissionEnum,
} from "@/types/contracts";
import { FUEL_LABEL, TRANSMISSION_LABEL } from "../labels";
import { EmptyState, ErrorState, PageHeader } from "../states";
import {
  ActiveDot,
  adminApi,
  ConfirmDialog,
  Field,
  useAdminList,
  useAdminMutation,
} from "./shared";
import type { AdminModel, AdminVariant } from "./types";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

type DeleteTarget = { kind: "model"; item: AdminModel } | { kind: "variant"; item: AdminVariant };

export function ModelsAdmin() {
  const models = useAdminList<AdminModel>("models");
  const variants = useAdminList<AdminVariant>("variants");
  const [modelDialog, setModelDialog] = useState<{ open: boolean; model: AdminModel | null }>({ open: false, model: null });
  const [variantDialog, setVariantDialog] = useState<{ open: boolean; variant: AdminVariant | null; modelId: string | null }>({
    open: false,
    variant: null,
    modelId: null,
  });
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);

  const toggleModel = useAdminMutation(
    "models",
    (m: AdminModel) => adminApi.update<AdminModel>("models", m.id, { isActive: !m.isActive }),
    { success: (r) => `${r.name} ${r.isActive ? "is live on the site" : "hidden from the site"}` },
  );
  const toggleVariant = useAdminMutation(
    "variants",
    (v: AdminVariant) => adminApi.update<AdminVariant>("variants", v.id, { isActive: !v.isActive }),
    { success: (r) => `${r.name} ${r.isActive ? "activated" : "deactivated"}` },
  );
  const remove = useAdminMutation(
    "models",
    (t: DeleteTarget) => adminApi.remove(t.kind === "model" ? "models" : "variants", t.item.id),
    { success: (_r, t) => `${t.item.name} deleted`, onSuccess: () => setToDelete(null), alsoInvalidate: ["variants", "prices"] },
  );

  const loading = models.isPending || variants.isPending;
  const error = models.error ?? variants.error;

  return (
    <div>
      <PageHeader
        title="Models & variants"
        description="What buyers see in the catalogue. Inactive items are hidden from the public site."
        actions={
          <Button onClick={() => setModelDialog({ open: true, model: null })}>
            <PlusIcon /> Add model
          </Button>
        }
      />
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            models.refetch();
            variants.refetch();
          }}
        />
      ) : models.data!.length === 0 ? (
        <EmptyState
          icon={CarFrontIcon}
          title="No models yet"
          description="Add the first model, then its variants and city prices."
          action={
            <Button onClick={() => setModelDialog({ open: true, model: null })}>
              <PlusIcon /> Add model
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {models.data!.map((m) => {
            const vs = variants.data!.filter((v) => v.modelId === m.id);
            return (
              <section key={m.id} className={cn("rounded-xl border bg-background", !m.isActive && "bg-muted/30")}>
                <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{m.name}</h2>
                      <span className="text-xs text-muted-foreground">{m.bodyType}</span>
                      <ActiveDot active={m.isActive} />
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">/cars/{m.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setModelDialog({ open: true, model: m })}>
                      <PencilIcon /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleModel.mutate(m)}
                      disabled={toggleModel.isPending && toggleModel.variables?.id === m.id}
                    >
                      {m.isActive ? <EyeOffIcon /> : <EyeIcon />}
                      {m.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setToDelete({ kind: "model", item: m })}
                      aria-label={`Delete ${m.name}`}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </header>
                <div className="px-4 py-2">
                  {vs.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">No variants yet.</p>
                  ) : (
                    <ul className="divide-y">
                      {vs.map((v) => (
                        <li key={v.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-sm font-medium">{v.name}</span>
                              {v.code && <span className="font-mono text-xs text-muted-foreground">{v.code}</span>}
                              <ActiveDot active={v.isActive} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {FUEL_LABEL[v.fuel]} · {TRANSMISSION_LABEL[v.transmission]} · {v.colours.length} colours
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="mr-2 text-sm font-medium tabular-nums">{formatINR(v.exShowroomPrice)}</span>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => setVariantDialog({ open: true, variant: v, modelId: m.id })}
                              aria-label={`Edit ${v.name}`}
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => toggleVariant.mutate(v)}
                              disabled={toggleVariant.isPending && toggleVariant.variables?.id === v.id}
                              aria-label={v.isActive ? `Deactivate ${v.name}` : `Activate ${v.name}`}
                              title={v.isActive ? "Deactivate" : "Activate"}
                            >
                              {v.isActive ? <EyeOffIcon /> : <EyeIcon />}
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setToDelete({ kind: "variant", item: v })}
                              aria-label={`Delete ${v.name}`}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="my-1 -ml-2"
                    onClick={() => setVariantDialog({ open: true, variant: null, modelId: m.id })}
                  >
                    <PlusIcon /> Add variant
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {modelDialog.open && (
        <ModelDialog model={modelDialog.model} onClose={() => setModelDialog({ open: false, model: null })} />
      )}
      {variantDialog.open && (
        <VariantDialog
          variant={variantDialog.variant}
          modelId={variantDialog.modelId}
          models={models.data ?? []}
          onClose={() => setVariantDialog({ open: false, variant: null, modelId: null })}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.item.name ?? ""}?`}
        description={
          toDelete?.kind === "model"
            ? "This removes the model, all its variants and their city prices. It cannot be undone. Models with leads or bookings can’t be deleted — deactivate them instead."
            : "This removes the variant and its city prices. It cannot be undone. Variants with leads or bookings can’t be deleted — deactivate them instead."
        }
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </div>
  );
}

// ─── Model form ────────────────────────────────────────────────────────────
const ModelFormSchema = AdminModelSchema.omit({ gallery: true }).extend({ galleryText: z.string() });
type ModelForm = z.input<typeof ModelFormSchema>;

function ModelDialog({ model, onClose }: { model: AdminModel | null; onClose: () => void }) {
  const form = useForm<ModelForm>({
    resolver: zodResolver(ModelFormSchema),
    defaultValues: model
      ? {
          name: model.name,
          slug: model.slug,
          bodyType: model.bodyType,
          description: model.description,
          descriptionHi: model.descriptionHi ?? "",
          heroImage: model.heroImage,
          galleryText: model.gallery.join("\n"),
          isActive: model.isActive,
        }
      : { name: "", slug: "", bodyType: "", description: "", descriptionHi: "", heroImage: "/cars/", galleryText: "", isActive: true },
  });
  const save = useAdminMutation(
    "models",
    (v: ModelForm) => {
      const body = {
        name: v.name,
        slug: v.slug,
        bodyType: v.bodyType,
        description: v.description,
        descriptionHi: v.descriptionHi?.trim() ? v.descriptionHi : undefined,
        heroImage: v.heroImage,
        gallery: v.galleryText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        isActive: v.isActive,
      };
      return model ? adminApi.update<AdminModel>("models", model.id, body) : adminApi.create<AdminModel>("models", body);
    },
    { success: (r) => `${(r as AdminModel).name} saved`, onSuccess: onClose, form },
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{model ? `Edit ${model.name}` : "Add model"}</DialogTitle>
          <DialogDescription>Shown on the catalogue and its own model page.</DialogDescription>
        </DialogHeader>
        <form id="model-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field form={form} name="name" label="Name">
            <Input
              id="name"
              {...form.register("name", {
                onChange: (e) => {
                  if (!model && !form.formState.dirtyFields.slug) form.setValue("slug", slugify(e.target.value));
                },
              })}
            />
          </Field>
          <Field form={form} name="slug" label="URL slug" hint="lowercase-with-dashes">
            <Input id="slug" className="font-mono" {...form.register("slug")} />
          </Field>
          <Field form={form} name="bodyType" label="Body type">
            <Input id="bodyType" placeholder="SUV, Sedan, Hatchback…" {...form.register("bodyType")} />
          </Field>
          <Field form={form} name="heroImage" label="Hero image path">
            <Input id="heroImage" className="font-mono" {...form.register("heroImage")} />
          </Field>
          <Field form={form} name="description" label="Description (English)" className="sm:col-span-2">
            <Textarea id="description" rows={3} {...form.register("description")} />
          </Field>
          <Field form={form} name="descriptionHi" label="Description (Hindi, optional)" className="sm:col-span-2">
            <Textarea id="descriptionHi" rows={3} lang="hi" {...form.register("descriptionHi")} />
          </Field>
          <Field form={form} name="galleryText" label="Gallery images" hint="One path per line, up to 12" className="sm:col-span-2">
            <Textarea id="galleryText" rows={3} className="font-mono text-xs" {...form.register("galleryText")} />
          </Field>
          <ActiveCheckbox form={form} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="model-form" disabled={save.isPending}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            {model ? "Save changes" : "Create model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveCheckbox({ form }: { form: any }) {
  const checked = form.watch("isActive") as boolean;
  return (
    <div className="flex items-center gap-2 sm:col-span-2">
      <Checkbox id="isActive" checked={checked} onCheckedChange={(c) => form.setValue("isActive", c === true, { shouldDirty: true })} />
      <Label htmlFor="isActive" className="font-normal">
        Active — visible on the public site
      </Label>
    </div>
  );
}

// ─── Variant form ──────────────────────────────────────────────────────────
const VariantFormSchema = AdminVariantSchema.omit({ specs: true }).extend({
  specRows: z.array(z.object({ key: z.string().trim().min(1, "Name"), value: z.string().trim().min(1, "Value") })).max(30),
  colours: z.array(ColourSchema.extend({ name: z.string().trim().min(1, "Name").max(40) })).max(12),
});
type VariantForm = z.input<typeof VariantFormSchema>;

function VariantDialog({
  variant,
  modelId,
  models,
  onClose,
}: {
  variant: AdminVariant | null;
  modelId: string | null;
  models: AdminModel[];
  onClose: () => void;
}) {
  const form = useForm<VariantForm>({
    resolver: zodResolver(VariantFormSchema),
    defaultValues: variant
      ? {
          modelId: variant.modelId,
          name: variant.name,
          slug: variant.slug,
          code: variant.code ?? "",
          fuel: variant.fuel,
          transmission: variant.transmission,
          exShowroomPrice: variant.exShowroomPrice,
          specRows: Object.entries(variant.specs ?? {}).map(([key, value]) => ({ key, value: String(value) })),
          colours: variant.colours.map((c) => ({ name: c.name, nameHi: c.nameHi ?? "", hex: c.hex })),
          isActive: variant.isActive,
        }
      : {
          modelId: modelId ?? "",
          name: "",
          slug: "",
          code: "",
          fuel: "PETROL",
          transmission: "MANUAL",
          exShowroomPrice: undefined as unknown as number,
          specRows: [
            { key: "engine", value: "" },
            { key: "power", value: "" },
            { key: "mileage", value: "" },
            { key: "seats", value: "" },
          ],
          colours: [{ name: "", nameHi: "", hex: "#ffffff" }],
          isActive: true,
        },
  });
  const specs = useFieldArray({ control: form.control, name: "specRows" });
  const colours = useFieldArray({ control: form.control, name: "colours" });

  const save = useAdminMutation(
    "variants",
    (v: VariantForm) => {
      const body = {
        modelId: v.modelId,
        name: v.name,
        slug: v.slug,
        code: v.code?.trim() ? v.code.trim() : undefined,
        fuel: v.fuel,
        transmission: v.transmission,
        exShowroomPrice: v.exShowroomPrice,
        // Numeric-looking spec values are stored as numbers (e.g. seats: 5).
        specs: Object.fromEntries(
          v.specRows.map((r) => [r.key.trim(), /^\d+(\.\d+)?$/.test(r.value.trim()) ? Number(r.value) : r.value.trim()]),
        ),
        colours: v.colours.map((c) => ({ name: c.name, hex: c.hex, ...(c.nameHi?.trim() ? { nameHi: c.nameHi } : {}) })),
        isActive: v.isActive,
      };
      return variant
        ? adminApi.update<AdminVariant>("variants", variant.id, body)
        : adminApi.create<AdminVariant>("variants", body);
    },
    { success: (r) => `${(r as AdminVariant).name} saved`, onSuccess: onClose, form, alsoInvalidate: ["prices"] },
  );
  const errs = form.formState.errors;

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{variant ? `Edit ${variant.name}` : "Add variant"}</DialogTitle>
          <DialogDescription>
            Ex-showroom price feeds every city’s on-road total. Set city components on the City prices tab.
          </DialogDescription>
        </DialogHeader>
        <form id="variant-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field form={form} name="modelId" label="Model">
            <Select value={form.watch("modelId")} onValueChange={(v) => form.setValue("modelId", v, { shouldValidate: true })}>
              <SelectTrigger id="modelId" className="w-full">
                <SelectValue placeholder="Choose model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field form={form} name="exShowroomPrice" label="Ex-showroom price (₹)" hint="Whole rupees">
            <Input
              id="exShowroomPrice"
              type="number"
              inputMode="numeric"
              min={100000}
              step={1000}
              className="tabular-nums"
              {...form.register("exShowroomPrice", { valueAsNumber: true })}
            />
          </Field>
          <Field form={form} name="name" label="Variant name">
            <Input
              id="name"
              placeholder="ZX Automatic Petrol"
              {...form.register("name", {
                onChange: (e) => {
                  if (!variant && !form.formState.dirtyFields.slug) form.setValue("slug", slugify(e.target.value));
                },
              })}
            />
          </Field>
          <Field form={form} name="slug" label="URL slug">
            <Input id="slug" className="font-mono" {...form.register("slug")} />
          </Field>
          <Field form={form} name="code" label="Catalogue code (optional)">
            <Input id="code" className="font-mono" placeholder="NEW-H-02" {...form.register("code")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field form={form} name="fuel" label="Fuel">
              <Select value={form.watch("fuel")} onValueChange={(v) => form.setValue("fuel", v as VariantForm["fuel"])}>
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
            <Field form={form} name="transmission" label="Gearbox">
              <Select
                value={form.watch("transmission")}
                onValueChange={(v) => form.setValue("transmission", v as VariantForm["transmission"])}
              >
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
          </div>

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Specifications</legend>
            {specs.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input
                  aria-label="Spec name"
                  placeholder="engine"
                  className="w-36 font-mono text-xs"
                  aria-invalid={!!errs.specRows?.[i]?.key}
                  {...form.register(`specRows.${i}.key`)}
                />
                <Input
                  aria-label="Spec value"
                  placeholder="1.5L petrol"
                  aria-invalid={!!errs.specRows?.[i]?.value}
                  {...form.register(`specRows.${i}.value`)}
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => specs.remove(i)} aria-label="Remove spec">
                  <XIcon />
                </Button>
              </div>
            ))}
            {errs.specRows && <p className="text-xs text-destructive">Fill in or remove empty spec rows.</p>}
            <Button type="button" size="sm" variant="ghost" className="-ml-2" onClick={() => specs.append({ key: "", value: "" })}>
              <PlusIcon /> Add spec
            </Button>
          </fieldset>

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Colours</legend>
            {colours.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <input
                  type="color"
                  aria-label="Colour swatch"
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                  {...form.register(`colours.${i}.hex`)}
                />
                <Input
                  aria-label="Colour name"
                  placeholder="Pearl White"
                  aria-invalid={!!errs.colours?.[i]?.name}
                  {...form.register(`colours.${i}.name`)}
                />
                <Input aria-label="Colour name in Hindi" placeholder="Hindi name" lang="hi" {...form.register(`colours.${i}.nameHi`)} />
                <Button type="button" size="icon" variant="ghost" onClick={() => colours.remove(i)} aria-label="Remove colour">
                  <XIcon />
                </Button>
              </div>
            ))}
            {errs.colours && <p className="text-xs text-destructive">Each colour needs a name and a valid colour.</p>}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="-ml-2"
              disabled={colours.fields.length >= 12}
              onClick={() => colours.append({ name: "", nameHi: "", hex: "#888888" })}
            >
              <PlusIcon /> Add colour
            </Button>
          </fieldset>
          <ActiveCheckbox form={form} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="variant-form" disabled={save.isPending}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            {variant ? "Save changes" : "Create variant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
