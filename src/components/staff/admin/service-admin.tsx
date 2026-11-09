"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheckIcon, CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateIST, formatTimeIST, isoDateIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdminServiceBooking,
  ServiceBookingList,
  ServiceBookingStatusValue,
  WorkshopUtilisation,
} from "@/server/services/service-slots";
import { api, errorMessage } from "../api";
import { EmptyState, ErrorState, PageHeader } from "../states";
import { ConfirmDialog } from "./shared";

// Staff & admin UI is English-only (see DECISIONS.md).
const SERVICE_TYPE_LABEL: Record<string, string> = {
  PERIODIC: "Periodic",
  REPAIR: "Repair",
  ACCIDENT: "Accident",
  OTHER: "Other",
};
const STATUS_VARIANT: Record<ServiceBookingStatusValue, "success" | "secondary" | "destructive"> = {
  CONFIRMED: "success",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
};
const ALL = "ALL";

type Action = { booking: AdminServiceBooking; status: "CANCELLED" | "COMPLETED" };

function shiftDate(date: string, days: number): string {
  return isoDateIST(days, new Date(`${date}T12:00:00+05:30`));
}

export function ServiceAdmin() {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => isoDateIST(0));
  const [workshopId, setWorkshopId] = useState<string>(ALL);
  const [status, setStatus] = useState<typeof ALL | ServiceBookingStatusValue>(ALL);
  const [action, setAction] = useState<Action | null>(null);

  const qs = new URLSearchParams({ date });
  if (workshopId !== ALL) qs.set("workshopId", workshopId);
  if (status !== ALL) qs.set("status", status);

  const list = useQuery({
    queryKey: ["admin", "service-bookings", date, workshopId, status],
    queryFn: () => api<ServiceBookingList>(`/api/service-bookings?${qs}`),
    placeholderData: keepPreviousData,
  });
  // Unfiltered workshop list for the filter dropdown (keeps all options while one is selected).
  const allWorkshops = useQuery({
    queryKey: ["admin", "service-bookings", "workshops", date],
    queryFn: () => api<ServiceBookingList>(`/api/service-bookings?date=${date}`),
    select: (d) => d.workshops.map((w) => ({ id: w.id, name: w.name })),
    staleTime: 60_000,
  });

  const mutate = useMutation({
    mutationFn: (a: Action) =>
      api<{ reference: string; status: string }>(`/api/service-bookings/${a.booking.id}`, {
        method: "PATCH",
        body: { status: a.status },
      }),
    onSuccess: (res) => {
      toast.success(`${res.reference} marked ${res.status.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["admin", "service-bookings"] });
      setAction(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      qc.invalidateQueries({ queryKey: ["admin", "service-bookings"] });
      setAction(null);
    },
  });

  const data = list.data;

  return (
    <div>
      <PageHeader
        title="Service bookings"
        description="Workshop bookings by day. Each slot holds as many cars as the workshop has bays; cancelling frees a bay for buyers immediately."
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="svc-date">Date</Label>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" aria-label="Previous day" onClick={() => setDate((d) => shiftDate(d, -1))}>
              <ChevronLeftIcon />
            </Button>
            <Input
              id="svc-date"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-40 bg-background"
            />
            <Button size="icon" variant="outline" aria-label="Next day" onClick={() => setDate((d) => shiftDate(d, 1))}>
              <ChevronRightIcon />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDate(isoDateIST(0))}>
              Today
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Workshop</Label>
          <Select value={workshopId} onValueChange={setWorkshopId}>
            <SelectTrigger size="sm" className="min-w-56 bg-background" aria-label="Filter by workshop">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All workshops</SelectItem>
              {(allWorkshops.data ?? []).map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger size="sm" className="min-w-40 bg-background" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : data ? (
        <div className={cn("space-y-6 transition-opacity", list.isPlaceholderData && "opacity-60")}>
          <section aria-labelledby="util-heading" className="space-y-3">
            <h2 id="util-heading" className="text-sm font-semibold">
              Bay utilisation · {formatDateIST(`${date}T12:00:00+05:30`, "en", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </h2>
            {data.workshops.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active workshops.</p>
            ) : (
              data.workshops.map((w) => <UtilisationRow key={w.id} w={w} />)
            )}
          </section>

          <section aria-labelledby="bookings-heading">
            <h2 id="bookings-heading" className="mb-3 text-sm font-semibold">
              Bookings ({data.bookings.length})
            </h2>
            {data.bookings.length === 0 ? (
              <EmptyState icon={CalendarCheckIcon} title="No service bookings for this day" />
            ) : (
              <BookingsTable bookings={data.bookings} onAction={setAction} />
            )}
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        title={
          action?.status === "CANCELLED"
            ? `Cancel ${action?.booking.reference}?`
            : `Mark ${action?.booking.reference} completed?`
        }
        description={
          action?.status === "CANCELLED"
            ? `${action?.booking.name}'s booking at ${formatTimeIST(action?.booking.slotStart ?? new Date(), "en")} will be cancelled and the bay released for other buyers. This can't be undone.`
            : "The service will be recorded as done and the booking closed."
        }
        confirmLabel={action?.status === "CANCELLED" ? "Cancel booking" : "Mark completed"}
        destructive={action?.status === "CANCELLED"}
        pending={mutate.isPending}
        onConfirm={() => action && mutate.mutate(action)}
      />
    </div>
  );
}

function UtilisationRow({ w }: { w: WorkshopUtilisation }) {
  const booked = w.slots.reduce((n, s) => n + s.booked, 0);
  const capacity = w.slots.length * w.bays;
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{w.name}</p>
        <p className="text-xs text-muted-foreground">
          {w.bays} bays · {booked} of {capacity} bay-slots booked
          {capacity > 0 && ` (${Math.round((booked / capacity) * 100)}%)`}
        </p>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {w.slots.map((s) => {
          const pct = s.bays > 0 ? Math.min(100, (s.booked / s.bays) * 100) : 100;
          const full = s.booked >= s.bays;
          return (
            <li
              key={s.start}
              className={cn("rounded-lg border p-2 text-center", full ? "border-destructive/30 bg-destructive/5" : "bg-muted/30")}
              aria-label={`${s.label}: ${s.booked} of ${s.bays} bays booked${full ? ", full" : ""}`}
            >
              <p className="tabular text-xs font-medium">{s.label}</p>
              <p className={cn("tabular text-sm font-semibold", full && "text-destructive")} aria-hidden>
                {s.booked}/{s.bays}
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn("h-full rounded-full", full ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-emerald-600")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BookingsTable({
  bookings,
  onAction,
}: {
  bookings: AdminServiceBooking[];
  onAction: (a: Action) => void;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-background md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Time</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Car</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Workshop</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id} className={cn(b.status === "CANCELLED" && "text-muted-foreground")}>
                <TableCell className="tabular py-2.5 pl-4 font-medium">{formatTimeIST(b.slotStart, "en")}</TableCell>
                <TableCell className="font-mono text-xs">{b.reference}</TableCell>
                <TableCell>
                  <p className="font-medium">{b.name}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    <a href={`tel:${b.phone}`} className="hover:underline">
                      {b.phone}
                    </a>
                    {b.email && ` · ${b.email}`}
                  </p>
                </TableCell>
                <TableCell>
                  <p>{b.modelName}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {b.registration}
                    {b.odometerKm != null && ` · ${b.odometerKm.toLocaleString("en-IN")} km`}
                  </p>
                </TableCell>
                <TableCell>
                  <p>{SERVICE_TYPE_LABEL[b.serviceType] ?? b.serviceType}</p>
                  {b.notes && (
                    <p className="max-w-56 truncate text-xs text-muted-foreground" title={b.notes}>
                      {b.notes}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm">{b.workshopName}</TableCell>
                <TableCell>
                  <StatusBadge status={b.status} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <BookingActions b={b} onAction={onAction} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="grid gap-2 md:hidden">
        {bookings.map((b) => (
          <li key={b.id} className="rounded-xl border bg-background p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="tabular">{formatTimeIST(b.slotStart, "en")}</span> · {b.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{b.reference}</span> · {b.workshopName}
                </p>
              </div>
              <StatusBadge status={b.status} />
            </div>
            <p className="mt-1.5 text-sm">
              {b.modelName} · <span className="tabular">{b.registration}</span>
              <span className="text-muted-foreground"> · {SERVICE_TYPE_LABEL[b.serviceType] ?? b.serviceType}</span>
            </p>
            <p className="tabular text-xs text-muted-foreground">
              <a href={`tel:${b.phone}`} className="hover:underline">
                {b.phone}
              </a>
            </p>
            {b.status === "CONFIRMED" && (
              <div className="mt-2 flex justify-end border-t pt-2">
                <BookingActions b={b} onAction={onAction} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function StatusBadge({ status }: { status: ServiceBookingStatusValue }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

function BookingActions({ b, onAction }: { b: AdminServiceBooking; onAction: (a: Action) => void }) {
  if (b.status !== "CONFIRMED") return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="inline-flex gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction({ booking: b, status: "COMPLETED" })}
        aria-label={`Mark ${b.reference} completed`}
      >
        <CheckCircle2Icon /> <span className="hidden lg:inline">Complete</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => onAction({ booking: b, status: "CANCELLED" })}
        aria-label={`Cancel ${b.reference}`}
      >
        <XCircleIcon /> <span className="hidden lg:inline">Cancel</span>
      </Button>
    </div>
  );
}
