"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2Icon, PencilIcon, PlusIcon, PowerIcon, TagIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateIST, isoDateIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminOfferSchema, offerStatus, toISTDateInput, type CmsStatus } from "@/server/workflows/cms.schema";
import { api } from "../api";
import { EmptyState, ErrorState, PageHeader } from "../states";
import { adminApi, adminKey, ConfirmDialog, Field, useAdminMutation, useLookups, type AdminResource } from "./shared";

// `shared.tsx` types its resource union for the original admin screens; the helpers only build
// `/api/admin/{resource}` URLs and `["admin", resource]` query keys, so the cast is safe.
const RES: AdminResource = "offers";

export type AdminOffer = {
  id: string;
  title: string;
  titleHi: string | null;
  body: string;
  bodyHi: string | null;
  modelId: string | null;
  model: { id: string; name: string; slug: string } | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  sortOrder: number;
};

// ─── Status chip (also used by banners-admin) ──────────────────────────────
const STATUS_TEXT: Record<CmsStatus, string> = { LIVE: "Live", SCHEDULED: "Scheduled", EXPIRED: "Expired", INACTIVE: "Inactive" };
const STATUS_STYLE: Record<CmsStatus, string> = {
  LIVE: "bg-success-soft text-success",
  SCHEDULED: "bg-warning-soft text-warning",
  EXPIRED: "bg-muted text-muted-foreground",
  INACTIVE: "bg-muted text-muted-foreground",
};
const STATUS_DOT: Record<CmsStatus, string> = {
  LIVE: "bg-emerald-600",
  SCHEDULED: "bg-amber-500",
  EXPIRED: "bg-zinc-400",
  INACTIVE: "bg-zinc-400",
};
export function CmsStatusChip({ status }: { status: CmsStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLE[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {STATUS_TEXT[status]}
    </span>
  );
}
export const CMS_STATUSES: CmsStatus[] = ["LIVE", "SCHEDULED", "EXPIRED", "INACTIVE"];
export { STATUS_TEXT as CMS_STATUS_TEXT };

export function StatusFilter({
  value,
  onChange,
}: {
  value: "ALL" | CmsStatus;
  onChange: (v: "ALL" | CmsStatus) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as "ALL" | CmsStatus)}>
      <SelectTrigger size="sm" className="min-w-40 bg-background" aria-label="Filter by status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All statuses</SelectItem>
        {CMS_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_TEXT[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── List ──────────────────────────────────────────────────────────────────
export function OffersAdmin() {
  const offers = useQuery({ queryKey: adminKey(RES), queryFn: () => api<AdminOffer[]>("/api/admin/offers") });
  const [editing, setEditing] = useState<{ open: boolean; offer: AdminOffer | null }>({ open: false, offer: null });
  const [toDelete, setToDelete] = useState<AdminOffer | null>(null);
  const [filter, setFilter] = useState<"ALL" | CmsStatus>("ALL");

  const toggle = useAdminMutation(
    RES,
    (o: AdminOffer) => adminApi.update<AdminOffer>(RES, o.id, { isActive: !o.isActive }),
    { success: (_r, o) => `“${o.title}” ${o.isActive ? "deactivated" : "activated"}` },
  );
  const remove = useAdminMutation(RES, (o: AdminOffer) => adminApi.remove(RES, o.id), {
    success: (_r, o) => `“${o.title}” deleted`,
    onSuccess: () => setToDelete(null),
  });

  const now = new Date();
  const rows = (offers.data ?? []).map((o) => ({ o, status: offerStatus(o, now) }));
  const list = rows.filter((r) => filter === "ALL" || r.status === filter);
  const counts = CMS_STATUSES.map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter((c) => c.n > 0);

  return (
    <div>
      <PageHeader
        title="Offers"
        description={
          offers.data && offers.data.length > 0 ? (
            <span>
              {counts.map(({ s, n }, i) => (
                <span key={s}>
                  {i > 0 && " · "}
                  {n} {STATUS_TEXT[s].toLowerCase()}
                </span>
              ))}
              {" · Text only — offers never change the on-road prices from the price table."}
            </span>
          ) : (
            "Text offers shown on model and variant pages. They never change on-road prices."
          )
        }
        actions={
          <Button onClick={() => setEditing({ open: true, offer: null })}>
            <PlusIcon /> New offer
          </Button>
        }
      />
      <div className="mb-4">
        <StatusFilter value={filter} onChange={setFilter} />
      </div>

      {offers.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : offers.isError ? (
        <ErrorState error={offers.error} onRetry={() => offers.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title={filter === "ALL" ? "No offers yet" : `No ${STATUS_TEXT[filter].toLowerCase()} offers`}
          description={filter === "ALL" ? "Create an offer to show it on model and variant pages." : undefined}
          action={
            filter === "ALL" ? (
              <Button onClick={() => setEditing({ open: true, offer: null })}>
                <PlusIcon /> New offer
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setFilter("ALL")}>
                Show all
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map(({ o, status }) => (
            <li
              key={o.id}
              className={cn("flex flex-col rounded-xl border bg-background", (status === "EXPIRED" || status === "INACTIVE") && "opacity-75")}
            >
              <div className="space-y-1.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-medium">{o.title}</p>
                  <CmsStatusChip status={status} />
                </div>
                {o.titleHi && (
                  <p className="text-sm text-muted-foreground" lang="hi">
                    {o.titleHi}
                  </p>
                )}
                <p className="line-clamp-2 text-sm text-muted-foreground">{o.body}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{o.model ? o.model.name : "All models"}</span> ·{" "}
                  {formatDateIST(o.validFrom)} – {formatDateIST(o.validUntil)}
                  {!o.titleHi || !o.bodyHi ? " · Hindi missing (English shown)" : ""}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t px-4 py-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggle.mutate(o)}
                  disabled={toggle.isPending && toggle.variables?.id === o.id}
                >
                  <PowerIcon /> {o.isActive ? "Deactivate" : "Activate"}
                </Button>
                <span className="text-xs text-muted-foreground">Order {o.sortOrder}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing({ open: true, offer: o })} aria-label={`Edit ${o.title}`}>
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToDelete(o)}
                    aria-label={`Delete ${o.title}`}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing.open && <OfferDialog offer={editing.offer} onClose={() => setEditing({ open: false, offer: null })} />}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.title ?? ""}”?`}
        description="The offer disappears from the site. This cannot be undone — deactivate it instead if you may reuse it."
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </div>
  );
}

// ─── Create / edit form ────────────────────────────────────────────────────
type OfferForm = z.input<typeof AdminOfferSchema>;

function OfferDialog({ offer, onClose }: { offer: AdminOffer | null; onClose: () => void }) {
  const lookups = useLookups();
  const form = useForm<OfferForm>({
    resolver: zodResolver(AdminOfferSchema),
    defaultValues: offer
      ? {
          title: offer.title,
          titleHi: offer.titleHi ?? "",
          body: offer.body,
          bodyHi: offer.bodyHi ?? "",
          modelId: offer.modelId ?? "",
          validFrom: toISTDateInput(offer.validFrom),
          validUntil: toISTDateInput(offer.validUntil),
          isActive: offer.isActive,
          sortOrder: offer.sortOrder,
        }
      : {
          title: "",
          titleHi: "",
          body: "",
          bodyHi: "",
          modelId: "",
          validFrom: isoDateIST(0),
          validUntil: isoDateIST(30),
          isActive: true,
          sortOrder: 0,
        },
  });

  const save = useAdminMutation(
    RES,
    (v: OfferForm) => (offer ? adminApi.update<AdminOffer>(RES, offer.id, v) : adminApi.create<AdminOffer>(RES, v)),
    { success: (r) => `“${(r as AdminOffer).title}” saved`, onSuccess: onClose, form },
  );
  const modelId = form.watch("modelId") || "ALL";
  const isActive = form.watch("isActive") !== false;

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{offer ? "Edit offer" : "New offer"}</DialogTitle>
          <DialogDescription>
            Offers are text only and are shown beside the price with a “subject to dealer terms” note. Don’t put rupee
            amounts that contradict the price table.
          </DialogDescription>
        </DialogHeader>
        <form
          id="offer-form"
          onSubmit={form.handleSubmit((v) => save.mutate(v as OfferForm))}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <Field form={form} name="title" label="Title (English)">
            <Input id="title" placeholder="Free 5-year extended warranty" {...form.register("title")} />
          </Field>
          <Field form={form} name="titleHi" label="Title (Hindi)" hint="Optional — English is shown when blank.">
            <Input id="titleHi" lang="hi" {...form.register("titleHi")} />
          </Field>
          <Field form={form} name="body" label="Details (English)">
            <Textarea id="body" rows={3} {...form.register("body")} />
          </Field>
          <Field form={form} name="bodyHi" label="Details (Hindi)">
            <Textarea id="bodyHi" rows={3} lang="hi" {...form.register("bodyHi")} />
          </Field>
          <Field form={form} name="modelId" label="Applies to">
            <Select
              value={modelId}
              onValueChange={(v) => form.setValue("modelId", v === "ALL" ? "" : v, { shouldDirty: true })}
            >
              <SelectTrigger id="modelId" className="w-full">
                <SelectValue placeholder={lookups.isPending ? "Loading…" : "All models"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All models</SelectItem>
                {(lookups.data?.models ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field form={form} name="sortOrder" label="Sort order" hint="Lower numbers show first.">
            <Input id="sortOrder" type="number" inputMode="numeric" min={0} {...form.register("sortOrder", { valueAsNumber: true })} />
          </Field>
          <Field form={form} name="validFrom" label="Valid from" hint="From the start of this day (IST).">
            <Input id="validFrom" type="date" {...form.register("validFrom")} />
          </Field>
          <Field form={form} name="validUntil" label="Valid until" hint="Through the end of this day (IST).">
            <Input id="validUntil" type="date" {...form.register("validUntil")} />
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(c) => form.setValue("isActive", c === true, { shouldDirty: true })}
            />
            <Label htmlFor="isActive" className="font-normal">
              Active — shown on the site while within its dates
            </Label>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="offer-form" disabled={save.isPending}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            {offer ? "Save changes" : "Create offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
