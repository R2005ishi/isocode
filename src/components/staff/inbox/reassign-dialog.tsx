"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, UserRoundCogIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ConsultantOption } from "@/types/contracts";
import { api } from "../api";
import { ErrorState } from "../states";

export function ReassignDialog({
  currentAssigneeId,
  pending,
  onReassign,
}: {
  currentAssigneeId: string | null;
  pending: boolean;
  onReassign: (consultant: ConsultantOption) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const consultants = useQuery({
    queryKey: ["consultants"],
    queryFn: () => api<ConsultantOption[]>("/api/consultants"),
    enabled: open,
  });
  const chosen = consultants.data?.find((c) => c.id === selected) ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (o) setSelected(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <UserRoundCogIcon /> Re-assign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Re-assign lead</DialogTitle>
          <DialogDescription>Pick the consultant who should call this buyer. Open-lead counts help balance the load.</DialogDescription>
        </DialogHeader>
        {consultants.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : consultants.isError ? (
          <ErrorState error={consultants.error} onRetry={() => consultants.refetch()} className="py-6" />
        ) : consultants.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active consultants found.</p>
        ) : (
          <ul role="radiogroup" aria-label="Consultants" className="-mx-1 max-h-80 space-y-1 overflow-y-auto px-1">
            {consultants.data.map((c) => {
              const isCurrent = c.id === currentAssigneeId;
              const isSel = c.id === selected;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    disabled={isCurrent}
                    onClick={() => setSelected(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
                      isSel && "border-primary bg-muted ring-1 ring-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        isSel && "border-primary bg-primary text-primary-foreground",
                      )}
                      aria-hidden
                    >
                      {isSel && <CheckIcon className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {c.name}
                        {isCurrent && <span className="font-normal text-muted-foreground"> · current</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{c.showroomName ?? "No showroom"}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {c.openLeads} open
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={!chosen || pending}
            onClick={async () => {
              if (!chosen) return;
              try {
                await onReassign(chosen);
                setOpen(false);
              } catch {
                // Error toast is raised by the mutation; keep the dialog open to retry.
              }
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            {chosen ? `Assign to ${chosen.name.split(" ")[0]}` : "Choose a consultant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
