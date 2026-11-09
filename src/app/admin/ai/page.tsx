import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { requireStaff } from "@/components/staff/require-staff";
import { formatStaffDateTime } from "@/components/staff/labels";
import { cn } from "@/lib/utils";
import { AI_REASON_LABEL, LIGHT_EDIT_MAX, type EditBucket } from "@/server/services/ai-quality";
import { getAiQuality, type RecentDraft } from "./ai-quality-data";

export const metadata: Metadata = { title: "AI quality" };
export const dynamic = "force-dynamic";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

const BUCKET: Record<EditBucket, { label: string; cls: string }> = {
  UNEDITED: { label: "Sent as drafted", cls: "bg-emerald-600" },
  LIGHT: { label: `Light edit (≤${LIGHT_EDIT_MAX * 100}% words)`, cls: "bg-amber-500" },
  HEAVY: { label: "Rewritten", cls: "bg-red-600" },
};

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function OutcomeChip({ d }: { d: RecentDraft }) {
  const text =
    d.status === "OK"
      ? d.attempts > 1
        ? "Fixed on retry"
        : "Passed checks"
      : `${d.status === "BLOCKED" ? "Blocked" : "Template"} · ${AI_REASON_LABEL[d.reason ?? "unknown"] ?? d.reason}`;
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        d.status === "OK" && d.attempts <= 1 && "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        d.status === "OK" && d.attempts > 1 && "border-sky-600/25 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
        d.status === "BLOCKED" && "border-red-600/25 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
        d.status === "FALLBACK" && "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
      )}
    >
      {text}
    </span>
  );
}

export default async function AiQualityPage() {
  await requireStaff(["ADMIN"], "/admin/ai");
  const { windowDays, quality: q, summaries, recent } = await getAiQuality();
  const blocked = sum(q.blocked);
  const fallback = sum(q.fallback);
  const reasons = [
    ...Object.entries(q.blocked).map(([r, n]) => ({ r, n, kind: "Blocked → safe template" })),
    ...Object.entries(q.fallback).map(([r, n]) => ({ r, n, kind: "AI unavailable → template" })),
  ].sort((a, b) => b.n - a.n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">AI quality</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          How the first-reply drafts behaved over the last {windowDays} days, including when the AI was wrong or
          unavailable. Drafts are never sent automatically: a consultant edits and sends every one.
        </p>
      </div>

      {q.drafts === 0 ? (
        <div className="rounded-xl border border-dashed bg-background p-10 text-center">
          <SparklesIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No AI drafts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a lead in the inbox and choose “Draft reply” — results will show up here.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Drafts generated" value={String(q.drafts)} hint={`${q.sent} sent by consultants`} />
            <Stat
              label="Passed checks"
              value={`${pct(q.okFirstTry + q.okAfterRetry, q.drafts)}%`}
              hint={`${q.okAfterRetry} fixed itself after a rejected first try`}
            />
            <Stat
              label="Caught by guardrails"
              value={String(blocked + q.okAfterRetry)}
              hint={`${blocked} replaced by a safe template`}
            />
            <Stat
              label="Sent without edits"
              value={q.sent ? `${pct(q.edits.UNEDITED, q.sent)}%` : "—"}
              hint={q.avgEditPct === null ? "Nothing sent yet" : `Avg ${q.avgEditPct}% of words changed`}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-background p-5">
              <h2 className="text-sm font-semibold">Consultant edits before sending</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Word-level difference between the draft and what was actually sent.
              </p>
              {q.sent === 0 ? (
                <p className="text-sm text-muted-foreground">No drafts sent yet.</p>
              ) : (
                <>
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Edit distribution">
                    {(Object.keys(BUCKET) as EditBucket[]).map((b) =>
                      q.edits[b] ? (
                        <div key={b} className={BUCKET[b].cls} style={{ width: `${pct(q.edits[b], q.sent)}%` }} />
                      ) : null,
                    )}
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {(Object.keys(BUCKET) as EditBucket[]).map((b) => (
                      <li key={b} className="flex items-center gap-2">
                        <span className={cn("size-2.5 rounded-full", BUCKET[b].cls)} aria-hidden />
                        <span className="flex-1">{BUCKET[b].label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {q.edits[b]} · {pct(q.edits[b], q.sent)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="rounded-xl border bg-background p-5">
              <h2 className="text-sm font-semibold">When the AI was wrong or unsure</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Rejected drafts get one retry with the reason; if that fails too, a safe template is used.
              </p>
              {reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every draft passed the checks.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {reasons.map(({ r, n, kind }) => (
                    <li key={`${kind}-${r}`} className="flex items-center gap-3 py-2">
                      <span className="flex-1">
                        {AI_REASON_LABEL[r] ?? r}
                        <span className="block text-xs text-muted-foreground">{kind}</span>
                      </span>
                      <span className="font-medium tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Buyer summaries: {summaries.ok} by AI, {summaries.fallback} basic fallback. Fallbacks this period:{" "}
                {fallback}.
              </p>
            </div>
          </section>

          <section className="rounded-xl border bg-background">
            <h2 className="border-b px-5 py-3 text-sm font-semibold">Recent drafts</h2>
            <ul className="divide-y">
              {recent.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <span className="min-w-40 flex-1">
                    {d.leadId ? (
                      <Link href={`/inbox/${d.leadId}`} className="font-medium hover:underline">
                        {d.leadName}
                      </Link>
                    ) : (
                      <span className="font-medium">{d.leadName}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">{formatStaffDateTime(d.createdAt)}</span>
                  </span>
                  <OutcomeChip d={d} />
                  <span className="w-36 text-right text-xs text-muted-foreground tabular-nums">
                    {d.sent ? (d.editPct === 0 ? "Sent unedited" : `Sent · ${d.editPct}% edited`) : "Not sent"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="flex gap-3 rounded-xl border bg-background p-5 text-sm">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-1 text-muted-foreground">
          <p className="font-medium text-foreground">Guarantees that don’t depend on the AI</p>
          <p>Prices in drafts must match the admin price table exactly, or the draft is rejected.</p>
          <p>Discount wording is blocked in the draft and checked again when the consultant presses Send.</p>
          <p>Nothing is sent without a consultant; opted-out buyers can’t be messaged.</p>
        </div>
      </section>
    </div>
  );
}
