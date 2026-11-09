"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BellOffIcon, ChevronRightIcon, InboxIcon, RefreshCwIcon, SearchXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  LeadStatusEnum,
  SlaStateEnum,
  type LeadListItem,
  type LeadStatus,
  type SlaState,
} from "@/types/contracts";
import { api } from "../api";
import { SLA_LABEL, SOURCE_LABEL, STATUS_LABEL, STATUS_ORDER, timeAgo } from "../labels";
import { EscalatedBadge, liveSla, SlaChip, useNow } from "../sla-chip";
import { EmptyState, ErrorState, PageHeader } from "../states";
import { StatusBadge } from "./status-badge";

const POLL_MS = 15_000;
const CLOSED: LeadStatus[] = ["WON", "LOST"];

/** Needs a first call: no contact yet and not closed. */
function isWaiting(l: LeadListItem) {
  return !l.firstContactAt && !CLOSED.includes(l.status);
}

/** Most urgent first: waiting leads oldest-first (closest to / past the 5-min line), then the rest newest-first. */
export function sortByUrgency(leads: LeadListItem[]): LeadListItem[] {
  const ts = (l: LeadListItem) => new Date(l.createdAt).getTime();
  const waiting = leads.filter(isWaiting).sort((a, b) => ts(a) - ts(b));
  const rest = leads.filter((l) => !isWaiting(l)).sort((a, b) => ts(b) - ts(a));
  return [...waiting, ...rest];
}

export function leadsQueryKey(scope: "mine" | "all", status?: LeadStatus) {
  return ["leads", { scope, status: status ?? null }] as const;
}

export function InboxView({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const scope: "mine" | "all" = isAdmin && params.get("scope") === "all" ? "all" : "mine";
  const statusParam = LeadStatusEnum.safeParse(params.get("status"));
  const status = statusParam.success ? statusParam.data : undefined;
  const slaParam = SlaStateEnum.safeParse(params.get("sla"));
  const slaFilter = slaParam.success ? slaParam.data : undefined;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const query = useQuery({
    queryKey: leadsQueryKey(scope, status),
    queryFn: () => {
      const qs = new URLSearchParams({ scope });
      if (status) qs.set("status", status);
      return api<LeadListItem[]>(`/api/leads?${qs}`);
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  const now = useNow(1000);
  const sorted = useMemo(() => (query.data ? sortByUrgency(query.data) : []), [query.data]);
  // SLA is filtered client-side against the live clock, so a lead moves from Amber to Red on time
  // rather than at the next poll.
  const visible = slaFilter ? sorted.filter((l) => liveSla(l, now) === slaFilter) : sorted;
  const waiting = sorted.filter(isWaiting);
  const overdue = waiting.filter((l) => liveSla(l, now) === "RED").length;
  const filtersActive = !!status || !!slaFilter;

  return (
    <div>
      <PageHeader
        title="Lead inbox"
        description={
          query.data ? (
            <span className="inline-flex flex-wrap items-center gap-x-1.5" aria-live="polite">
              <span className="text-foreground font-medium">{waiting.length} waiting</span>
              <span aria-hidden>·</span>
              <span className={cn(overdue > 0 && "font-medium text-red-700 dark:text-red-400")}>
                {overdue} overdue
              </span>
              <span aria-hidden>·</span>
              <span>{sorted.length} total</span>
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <span className="hidden sm:inline">Call every new lead within 5 minutes.</span>
            </span>
          ) : (
            "Call every new lead within 5 minutes."
          )
        }
        actions={
          <>
            {isAdmin && (
              <div
                role="group"
                aria-label="Whose leads"
                className="bg-background inline-flex rounded-lg border p-0.5"
              >
                {(["mine", "all"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={scope === s}
                    onClick={() => setParam("scope", s === "all" ? "all" : null)}
                    className={cn(
                      "text-muted-foreground h-7 rounded-md px-3 text-sm font-medium transition-colors",
                      scope === s && "bg-primary text-primary-foreground",
                    )}
                  >
                    {s === "mine" ? "Mine" : "All"}
                  </button>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              aria-label="Refresh leads"
            >
              <RefreshCwIcon className={cn(query.isFetching && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={status ?? "ALL"}
          onValueChange={(v) => setParam("status", v === "ALL" ? null : v)}
        >
          <SelectTrigger size="sm" className="bg-background min-w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={slaFilter ?? "ALL"}
          onValueChange={(v) => setParam("sla", v === "ALL" ? null : v)}
        >
          <SelectTrigger
            size="sm"
            className="bg-background min-w-40"
            aria-label="Filter by response timer"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any timer</SelectItem>
            {(["RED", "AMBER", "GREEN", "BREACHED", "MET"] as SlaState[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SLA_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              const next = new URLSearchParams(params.toString());
              next.delete("status");
              next.delete("sla");
              const qs = next.toString();
              router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {query.isPending ? (
        <InboxSkeleton />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => query.refetch()}
          title="Couldn’t load leads"
        />
      ) : visible.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={SearchXIcon}
            title="No leads match these filters"
            action={
              <Button variant="outline" onClick={() => router.replace(pathname)}>
                Show all leads
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={InboxIcon}
            title="No new leads — nice work."
            description="New enquiries and test-drive bookings appear here automatically."
          />
        )
      ) : (
        <>
          <LeadTable leads={visible} now={now} showAssignee={isAdmin} />
          <LeadCards leads={visible} now={now} showAssignee={isAdmin} />
        </>
      )}
    </div>
  );
}

function LeadTable({
  leads,
  now,
  showAssignee,
}: {
  leads: LeadListItem[];
  now: number;
  showAssignee: boolean;
}) {
  const router = useRouter();
  return (
    <div className="bg-background hidden overflow-hidden rounded-xl border md:block">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-36 pl-4">Response timer</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Interest</TableHead>
            <TableHead className="hidden lg:table-cell">Source</TableHead>
            <TableHead>Status</TableHead>
            {showAssignee && <TableHead className="hidden xl:table-cell">Consultant</TableHead>}
            <TableHead className="pr-4 text-right">Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((l) => (
            <TableRow
              key={l.id}
              className="cursor-pointer"
              onClick={() => router.push(`/inbox/${l.id}`)}
            >
              <TableCell className="py-3 pl-4">
                <div className="flex flex-col items-start gap-1">
                  <SlaChip lead={l} now={now} />
                  <EscalatedBadge level={l.escalationLevel} />
                </div>
              </TableCell>
              <TableCell className="py-3">
                <Link
                  href={`/inbox/${l.id}`}
                  className="font-medium hover:underline focus-visible:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {l.name}
                </Link>
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs tabular-nums">
                  {l.phoneMasked}
                  {l.optedOut && <OptedOutTag />}
                </div>
              </TableCell>
              <TableCell className="max-w-56 py-3">
                <div className="truncate">
                  {l.interest ?? <span className="text-muted-foreground">General enquiry</span>}
                </div>
                {l.showroomName && (
                  <div className="text-muted-foreground truncate text-xs">{l.showroomName}</div>
                )}
              </TableCell>
              <TableCell className="hidden py-3 lg:table-cell">
                <Badge variant="outline">
                  {SOURCE_LABEL[l.source]}
                  {l.source === "PORTAL" && l.portalName ? ` · ${l.portalName}` : ""}
                </Badge>
              </TableCell>
              <TableCell className="py-3">
                <StatusBadge status={l.status} />
              </TableCell>
              {showAssignee && (
                <TableCell className="hidden py-3 xl:table-cell">
                  {l.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span>}
                </TableCell>
              )}
              <TableCell className="text-muted-foreground py-3 pr-4 text-right text-xs whitespace-nowrap">
                {timeAgo(l.createdAt, now)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LeadCards({
  leads,
  now,
  showAssignee,
}: {
  leads: LeadListItem[];
  now: number;
  showAssignee: boolean;
}) {
  return (
    <ul className="grid gap-2 md:hidden">
      {leads.map((l) => (
        <li key={l.id}>
          <Link
            href={`/inbox/${l.id}`}
            className="bg-background active:bg-muted block rounded-xl border p-3.5 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.name}</p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {l.phoneMasked} · {timeAgo(l.createdAt, now)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <SlaChip lead={l} now={now} />
                <EscalatedBadge level={l.escalationLevel} />
              </div>
            </div>
            <p className="mt-2 truncate text-sm">
              {l.interest ?? <span className="text-muted-foreground">General enquiry</span>}
              {l.showroomName && <span className="text-muted-foreground"> · {l.showroomName}</span>}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={l.status} />
              <Badge variant="outline">
                {SOURCE_LABEL[l.source]}
                {l.source === "PORTAL" && l.portalName ? ` · ${l.portalName}` : ""}
              </Badge>
              {l.optedOut && <OptedOutTag />}
              {showAssignee && (
                <span className="text-muted-foreground ml-auto truncate text-xs">
                  {l.assignedTo?.name ?? "Unassigned"}
                </span>
              )}
              {!showAssignee && (
                <ChevronRightIcon className="text-muted-foreground ml-auto size-4" aria-hidden />
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function OptedOutTag() {
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium">
      <BellOffIcon className="size-3" aria-hidden /> Opted out
    </span>
  );
}

function InboxSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading leads">
      <div className="bg-background hidden space-y-0 overflow-hidden rounded-xl border md:block">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
            <Skeleton className="h-6 w-24 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
