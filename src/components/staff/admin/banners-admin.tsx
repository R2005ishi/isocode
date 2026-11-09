"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ExternalLinkIcon, ImageIcon, Loader2Icon, MegaphoneIcon, PencilIcon, PlusIcon, PowerIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminBannerSchema, bannerStatus, toISTDateInput, type CmsStatus } from "@/server/workflows/cms.schema";
import { api } from "../api";
import { EmptyState, ErrorState, PageHeader } from "../states";
import { adminApi, adminKey, ConfirmDialog, Field, useAdminMutation, type AdminResource } from "./shared";
import { CMS_STATUS_TEXT, CMS_STATUSES, CmsStatusChip, StatusFilter } from "./offers-admin";

// See offers-admin.tsx: the shared helpers only build URLs and query keys from this string.
const RES: AdminResource = "banners";

export type AdminBanner = {
  id: string;
  title: string;
  titleHi: string | null;
  subtitle: string | null;
  subtitleHi: string | null;
  image: string | null;
  ctaLabel: string | null;
  ctaLabelHi: string | null;
  ctaHref: string | null;
  placement: string;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
};

const PLACEMENT_LABEL: Record<string, string> = { HOME: "Home page" };

function schedule(b: AdminBanner) {
  if (b.startsAt && b.endsAt) return `${formatDateIST(b.startsAt)} – ${formatDateIST(b.endsAt)}`;
  if (b.startsAt) return `From ${formatDateIST(b.startsAt)}`;
  if (b.endsAt) return `Until ${formatDateIST(b.endsAt)}`;
  return "No end date";
}

export function BannersAdmin() {
  const banners = useQuery({ queryKey: adminKey(RES), queryFn: () => api<AdminBanner[]>("/api/admin/banners") });
  const [editing, setEditing] = useState<{ open: boolean; banner: AdminBanner | null }>({ open: false, banner: null });
  const [toDelete, setToDelete] = useState<AdminBanner | null>(null);
  const [filter, setFilter] = useState<"ALL" | CmsStatus>("ALL");

  const toggle = useAdminMutation(
    RES,
    (b: AdminBanner) => adminApi.update<AdminBanner>(RES, b.id, { isActive: !b.isActive }),
    { success: (_r, b) => `“${b.title}” ${b.isActive ? "deactivated" : "activated"}` },
  );
  const remove = useAdminMutation(RES, (b: AdminBanner) => adminApi.remove(RES, b.id), {
    success: (_r, b) => `“${b.title}” deleted`,
    onSuccess: () => setToDelete(null),
  });

  const now = new Date();
  const rows = (banners.data ?? []).map((b) => ({ b, status: bannerStatus(b, now) }));
  const list = rows.filter((r) => filter === "ALL" || r.status === filter);
  const counts = CMS_STATUSES.map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter((c) => c.n > 0);

  return (
    <div>
      <PageHeader
        title="Banners"
        description={
          banners.data && banners.data.length > 0 ? (
            <span>
              {counts.map(({ s, n }, i) => (
                <span key={s}>
                  {i > 0 && " · "}
                  {n} {CMS_STATUS_TEXT[s].toLowerCase()}
                </span>
              ))}
              {" · Live home-page banners show below the hero (up to 5)."}
            </span>
          ) : (
            "Promotional banners shown on the home page, below the hero."
          )
        }
        actions={
          <Button onClick={() => setEditing({ open: true, banner: null })}>
            <PlusIcon /> New banner
          </Button>
        }
      />
      <div className="mb-4">
        <StatusFilter value={filter} onChange={setFilter} />
      </div>

      {banners.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : banners.isError ? (
        <ErrorState error={banners.error} onRetry={() => banners.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={MegaphoneIcon}
          title={filter === "ALL" ? "No banners yet" : `No ${CMS_STATUS_TEXT[filter].toLowerCase()} banners`}
          description={filter === "ALL" ? "When there are no live banners, the home page simply shows nothing extra." : undefined}
          action={
            filter === "ALL" ? (
              <Button onClick={() => setEditing({ open: true, banner: null })}>
                <PlusIcon /> New banner
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
          {list.map(({ b, status }) => (
            <li
              key={b.id}
              className={cn("flex flex-col rounded-xl border bg-background", (status === "EXPIRED" || status === "INACTIVE") && "opacity-75")}
            >
              <div className="flex gap-3 p-4">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {b.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an admin-entered path
                    <img src={b.image} alt="" className="size-full object-contain" />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-medium">{b.title}</p>
                    <CmsStatusChip status={status} />
                  </div>
                  {b.subtitle && <p className="line-clamp-2 text-sm text-muted-foreground">{b.subtitle}</p>}
                  <p className="text-xs text-muted-foreground">
                    {PLACEMENT_LABEL[b.placement] ?? b.placement} · {schedule(b)}
                    {b.ctaHref && (
                      <>
                        {" · "}
                        <span className="font-mono">{b.ctaHref}</span>
                      </>
                    )}
                    {!b.titleHi ? " · Hindi missing (English shown)" : ""}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t px-4 py-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggle.mutate(b)}
                  disabled={toggle.isPending && toggle.variables?.id === b.id}
                >
                  <PowerIcon /> {b.isActive ? "Deactivate" : "Activate"}
                </Button>
                <span className="text-xs text-muted-foreground">Order {b.sortOrder}</span>
                <div className="ml-auto flex gap-1">
                  {b.ctaHref && (
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`Open link of ${b.title}`}>
                      <a href={b.ctaHref} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon />
                      </a>
                    </Button>
                  )}
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing({ open: true, banner: b })} aria-label={`Edit ${b.title}`}>
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToDelete(b)}
                    aria-label={`Delete ${b.title}`}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing.open && <BannerDialog banner={editing.banner} onClose={() => setEditing({ open: false, banner: null })} />}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.title ?? ""}”?`}
        description="The banner disappears from the site. This cannot be undone — deactivate it instead if you may reuse it."
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </div>
  );
}

// ─── Create / edit form ────────────────────────────────────────────────────
type BannerForm = z.input<typeof AdminBannerSchema>;

function BannerDialog({ banner, onClose }: { banner: AdminBanner | null; onClose: () => void }) {
  const form = useForm<BannerForm>({
    resolver: zodResolver(AdminBannerSchema),
    defaultValues: {
      title: banner?.title ?? "",
      titleHi: banner?.titleHi ?? "",
      subtitle: banner?.subtitle ?? "",
      subtitleHi: banner?.subtitleHi ?? "",
      image: banner?.image ?? "",
      ctaLabel: banner?.ctaLabel ?? "",
      ctaLabelHi: banner?.ctaLabelHi ?? "",
      ctaHref: banner?.ctaHref ?? "",
      placement: "HOME",
      isActive: banner?.isActive ?? true,
      sortOrder: banner?.sortOrder ?? 0,
      startsAt: toISTDateInput(banner?.startsAt),
      endsAt: toISTDateInput(banner?.endsAt),
    },
  });

  const save = useAdminMutation(
    RES,
    (v: BannerForm) => (banner ? adminApi.update<AdminBanner>(RES, banner.id, v) : adminApi.create<AdminBanner>(RES, v)),
    { success: (r) => `“${(r as AdminBanner).title}” saved`, onSuccess: onClose, form },
  );
  const isActive = form.watch("isActive") !== false;
  const preview = form.watch("image");

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{banner ? "Edit banner" : "New banner"}</DialogTitle>
          <DialogDescription>Shown on the home page below the hero. Links must be pages on this site.</DialogDescription>
        </DialogHeader>
        <form
          id="banner-form"
          onSubmit={form.handleSubmit((v) => save.mutate(v as BannerForm))}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <Field form={form} name="title" label="Title (English)">
            <Input id="title" placeholder="Festive test-drive week" {...form.register("title")} />
          </Field>
          <Field form={form} name="titleHi" label="Title (Hindi)" hint="Optional — English is shown when blank.">
            <Input id="titleHi" lang="hi" {...form.register("titleHi")} />
          </Field>
          <Field form={form} name="subtitle" label="Subtitle (English)">
            <Input id="subtitle" {...form.register("subtitle")} />
          </Field>
          <Field form={form} name="subtitleHi" label="Subtitle (Hindi)">
            <Input id="subtitleHi" lang="hi" {...form.register("subtitleHi")} />
          </Field>
          <Field form={form} name="ctaLabel" label="Button label (English)">
            <Input id="ctaLabel" placeholder="Book a test drive" {...form.register("ctaLabel")} />
          </Field>
          <Field form={form} name="ctaLabelHi" label="Button label (Hindi)">
            <Input id="ctaLabelHi" lang="hi" {...form.register("ctaLabelHi")} />
          </Field>
          <Field form={form} name="ctaHref" label="Button link" hint="A page on this site, e.g. /test-drive or /cars/model-h">
            <Input id="ctaHref" className="font-mono" placeholder="/test-drive" {...form.register("ctaHref")} />
          </Field>
          <Field form={form} name="image" label="Image" hint="Path under /public, e.g. /cars/model-h.svg">
            <div className="flex gap-2">
              <Input id="image" className="font-mono" placeholder="/cars/model-h.svg" {...form.register("image")} />
              <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {preview && preview.startsWith("/") && !preview.startsWith("//") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- live preview of an admin-entered path
                  <img src={preview} alt="" className="size-full object-contain" />
                ) : (
                  <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
                )}
              </div>
            </div>
          </Field>
          <Field form={form} name="startsAt" label="Starts" hint="Optional — from the start of this day (IST).">
            <Input id="startsAt" type="date" {...form.register("startsAt")} />
          </Field>
          <Field form={form} name="endsAt" label="Ends" hint="Optional — through the end of this day (IST).">
            <Input id="endsAt" type="date" {...form.register("endsAt")} />
          </Field>
          <Field form={form} name="placement" label="Placement" hint="Only the home page for now.">
            <Input id="placement" value="Home page" readOnly disabled />
          </Field>
          <Field form={form} name="sortOrder" label="Sort order" hint="Lower numbers show first.">
            <Input id="sortOrder" type="number" inputMode="numeric" min={0} {...form.register("sortOrder", { valueAsNumber: true })} />
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
          <Button type="submit" form="banner-form" disabled={save.isPending}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            {banner ? "Save changes" : "Create banner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
