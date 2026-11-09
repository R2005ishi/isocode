"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, ApiClientError, errorMessage } from "../api";
import type { AdminLookups } from "./types";

export type AdminResource = "models" | "variants" | "prices" | "used-cars" | "users" | "offers" | "banners";

export const adminKey = (r: AdminResource | "lookups") => ["admin", r] as const;

export function useAdminList<T>(resource: AdminResource) {
  return useQuery({
    queryKey: adminKey(resource),
    queryFn: () => api<T[]>(`/api/admin/${resource}`),
  });
}

export function useLookups() {
  return useQuery({
    queryKey: adminKey("lookups"),
    queryFn: () => api<AdminLookups>("/api/admin/lookups"),
    staleTime: 60_000,
  });
}

/**
 * Create / update / delete against `/api/admin/{resource}[/{id}]`, with toasts and cache refresh.
 * Server field errors are pushed back into the form when one is provided.
 */
export function useAdminMutation<TVars, TRes = unknown>(
  resource: AdminResource,
  fn: (vars: TVars) => Promise<TRes>,
  opts: {
    success?: string | ((res: TRes, vars: TVars) => string);
    onSuccess?: (res: TRes, vars: TVars) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form?: UseFormReturn<any>;
    alsoInvalidate?: AdminResource[];
  } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (res, vars) => {
      for (const r of [resource, ...(opts.alsoInvalidate ?? [])]) qc.invalidateQueries({ queryKey: adminKey(r) });
      qc.invalidateQueries({ queryKey: adminKey("lookups") });
      const msg = typeof opts.success === "function" ? opts.success(res, vars) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(res, vars);
    },
    onError: (err) => {
      if (opts.form && err instanceof ApiClientError && err.fields) {
        for (const [k, v] of Object.entries(err.fields)) opts.form.setError(k, { type: "server", message: v });
      }
      toast.error(errorMessage(err));
    },
  });
}

export const adminApi = {
  create: <T,>(resource: AdminResource, body: unknown) => api<T>(`/api/admin/${resource}`, { method: "POST", body }),
  update: <T,>(resource: AdminResource, id: string, body: unknown) =>
    api<T>(`/api/admin/${resource}/${id}`, { method: "PATCH", body }),
  remove: (resource: AdminResource, id: string) => api<unknown>(`/api/admin/${resource}/${id}`, { method: "DELETE" }),
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  pending,
  onConfirm,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Label + control + error message, wired for accessibility. */
export function Field<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  className,
  children,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const err = name.split(".").reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    form.formState.errors,
  ) as { message?: string } | undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {err?.message ? (
        <p className="text-xs text-destructive" role="alert">
          {err.message}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function ActiveDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-600" : "bg-zinc-400")} aria-hidden />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/** `"12,45,000"`-tolerant integer parsing for money inputs. */
export function toInt(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[,\s₹]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
