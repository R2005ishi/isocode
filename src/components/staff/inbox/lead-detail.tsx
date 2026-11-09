"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BellOffIcon,
  CalendarIcon,
  CarFrontIcon,
  CheckIcon,
  HistoryIcon,
  Loader2Icon,
  MailIcon,
  PhoneCallIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  UserRoundIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConsultantOption, LeadDetail, LeadStatus } from "@/types/contracts";
import { api, ApiClientError } from "../api";
import { SOURCE_LABEL, STATUS_LABEL, STATUS_ORDER, formatStaffDateTime } from "../labels";
import { SlaChip, useNow } from "../sla-chip";
import { EmptyState, ErrorState } from "../states";
import { AiDraftPanel } from "./ai-draft-panel";
import { AiSummaryPanel } from "./ai-summary-panel";
import { Panel } from "./panel";
import { ReassignDialog } from "./reassign-dialog";
import { StatusBadge } from "./status-badge";
import { Timeline } from "./timeline";
import { useLead, useLeadMutation } from "./use-lead";

export function LeadDetailView({
  leadId,
  me,
}: {
  leadId: string;
  me: { id: string; role: "CONSULTANT" | "ADMIN" };
}) {
  const lead = useLead(leadId);
  if (lead.isPending) return <DetailSkeleton />;
  if (lead.isError) {
    const err = lead.error;
    if (err instanceof ApiClientError && (err.status === 404 || err.status === 403)) {
      return (
        <EmptyState
          icon={ShieldXIcon}
          title="Lead not found"
          description="It may have been re-assigned to another consultant, or the link is wrong."
          action={
            <Button asChild variant="outline">
              <Link href="/inbox">Back to inbox</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={err} onRetry={() => lead.refetch()} title="Couldn’t load this lead" />;
  }
  return <LeadDetailLoaded lead={lead.data} me={me} />;
}

function LeadDetailLoaded({ lead, me }: { lead: LeadDetail; me: { id: string; role: "CONSULTANT" | "ADMIN" } }) {
  const router = useRouter();
  const now = useNow(1000);

  const contact = useLeadMutation(
    lead.id,
    () => api<LeadDetail>(`/api/leads/${lead.id}/contact`, { method: "POST", body: {} }),
    { success: "Marked as contacted" },
  );
  const setStatus = useLeadMutation(
    lead.id,
    (status: LeadStatus) => api<LeadDetail>(`/api/leads/${lead.id}`, { method: "PATCH", body: { status } }),
    { success: (_l, s) => `Status changed to ${STATUS_LABEL[s]}` },
  );
  const reassign = useLeadMutation(
    lead.id,
    (c: ConsultantOption) =>
      api<LeadDetail>(`/api/leads/${lead.id}`, { method: "PATCH", body: { assignedToId: c.id } }),
    {
      success: (_l, c) => `Lead re-assigned to ${c.name}`,
      onSuccess: (_l, c) => {
        // A consultant can no longer open a lead that isn't theirs.
        if (me.role === "CONSULTANT" && c.id !== me.id) router.replace("/inbox");
      },
    },
  );

  // Don't pre-fill the composer with a draft that a later message already used.
  const unsentDraft =
    lead.latestDraft &&
    !lead.messages.some((m) => new Date(m.createdAt) >= new Date(lead.latestDraft!.createdAt))
      ? lead.latestDraft
      : null;

  return (
    <div className="space-y-4">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Inbox
      </Link>

      {/* Header + actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{lead.name}</h1>
            <SlaChip lead={lead} now={now} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <StatusBadge status={lead.status} />
            <Badge variant="outline">{SOURCE_LABEL[lead.source]}</Badge>
            <span>Received {formatStaffDateTime(lead.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>{lead.assignedTo ? `Assigned to ${lead.assignedTo.name}` : "Unassigned"}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lead.firstContactAt ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm text-muted-foreground">
              <CheckIcon className="size-4 text-emerald-600" aria-hidden />
              Contacted {formatStaffDateTime(lead.firstContactAt)}
            </span>
          ) : (
            <Button size="sm" className="h-8" onClick={() => contact.mutate(undefined)} disabled={contact.isPending}>
              {contact.isPending ? <Loader2Icon className="animate-spin" /> : <PhoneCallIcon />}
              Mark contacted
            </Button>
          )}
          <Select
            value={lead.status}
            onValueChange={(v) => v !== lead.status && setStatus.mutate(v as LeadStatus)}
            disabled={setStatus.isPending}
          >
            <SelectTrigger size="sm" className="w-44 bg-background" aria-label="Change status">
              {setStatus.isPending && <Loader2Icon className="animate-spin" />}
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ReassignDialog
            currentAssigneeId={lead.assignedTo?.id ?? null}
            pending={reassign.isPending}
            onReassign={(c) => reassign.mutateAsync(c)}
          />
        </div>
      </div>

      {lead.optedOut && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <BellOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">This buyer has opted out</span> under the DPDP Act. Do not send messages; sending
            is disabled.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-4">
          <BuyerCard lead={lead} />
          <AiSummaryPanel leadId={lead.id} summary={lead.latestSummary} />
          <AiDraftPanel
            key={unsentDraft?.id ?? "none"}
            leadId={lead.id}
            leadLocale={lead.locale}
            latestDraft={unsentDraft}
            optedOut={lead.optedOut}
            buyerName={lead.name}
            phone={lead.phone}
          />
        </div>
        <div className="space-y-4">
          <Panel icon={CalendarIcon} title="Test drives">
            {lead.bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test drive booked.</p>
            ) : (
              <ul className="space-y-2">
                {lead.bookings.map((b) => (
                  <li key={b.id} className="rounded-lg border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{b.reference}</span>
                      <Badge variant="secondary">{b.status.charAt(0) + b.status.slice(1).toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium">{b.carLabel}</p>
                    <p className="text-xs text-muted-foreground">{formatStaffDateTime(b.slotStart)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel icon={HistoryIcon} title="Timeline">
            <Timeline lead={lead} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function BuyerCard({ lead }: { lead: LeadDetail }) {
  return (
    <Panel icon={UserRoundIcon} title="Buyer">
      <div className="grid gap-4 sm:grid-cols-2">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd>
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1.5 text-base font-semibold tabular-nums underline-offset-4 hover:underline"
              >
                <PhoneIcon className="size-4" aria-hidden />
                {lead.phone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd>
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 break-all hover:underline">
                  <MailIcon className="size-3.5 shrink-0" aria-hidden />
                  {lead.email}
                </a>
              ) : (
                <span className="text-muted-foreground">Not given</span>
              )}
            </dd>
          </div>
          <div className="flex gap-6">
            <div>
              <dt className="text-xs text-muted-foreground">Language</dt>
              <dd>{lead.locale === "hi" ? "Hindi (हिन्दी)" : "English"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Consent</dt>
              <dd>
                {lead.consent ? (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheckIcon className="size-4 text-emerald-600" aria-hidden />
                    Given
                    {lead.consentAt && (
                      <span className="text-xs text-muted-foreground">· {formatStaffDateTime(lead.consentAt)}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not recorded</span>
                )}
              </dd>
            </div>
          </div>
        </dl>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Interested in</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <CarFrontIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {lead.interest ?? "General enquiry"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Showroom</dt>
            <dd>{lead.showroomName ?? <span className="text-muted-foreground">Not chosen</span>}</dd>
          </div>
          {lead.message && (
            <div>
              <dt className="text-xs text-muted-foreground">Buyer’s message</dt>
              <dd className="mt-1 rounded-lg bg-muted/60 px-3 py-2 whitespace-pre-wrap">{lead.message}</dd>
            </div>
          )}
        </dl>
      </div>
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading lead">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
