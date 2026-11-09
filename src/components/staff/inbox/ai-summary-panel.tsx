"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleAlertIcon, Loader2Icon, SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AiSummaryResult } from "@/types/contracts";
import { api, errorMessage } from "../api";
import { formatStaffDateTime } from "../labels";
import { leadKey } from "./use-lead";
import { Panel } from "./panel";

const CONFIDENCE: Record<AiSummaryResult["summary"]["confidence"], { label: string; cls: string }> = {
  high: { label: "High confidence", cls: "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  medium: { label: "Medium confidence", cls: "border-border bg-muted text-foreground" },
  low: { label: "Low confidence", cls: "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300" },
};

export function AiSummaryPanel({ leadId, summary }: { leadId: string; summary: AiSummaryResult | null }) {
  const qc = useQueryClient();
  const gen = useMutation({
    mutationFn: () => api<AiSummaryResult>(`/api/leads/${leadId}/ai/summary`, { method: "POST", body: {} }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: leadKey(leadId) });
      if (res.status === "FALLBACK") toast.warning("AI unavailable — showing a basic summary instead.");
      else toast.success("Summary ready");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  // Show the fresh result immediately; the lead refetch keeps it in sync afterwards.
  const result = gen.data ?? summary;

  return (
    <Panel
      icon={SparklesIcon}
      title="AI buyer summary"
      description="What the buyer wants, from their enquiry and history."
      action={
        <Button size="sm" variant={result ? "outline" : "default"} onClick={() => gen.mutate()} disabled={gen.isPending}>
          {gen.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          {gen.isPending ? "Summarising…" : result ? "Regenerate" : "Generate summary"}
        </Button>
      }
    >
      {gen.isPending && !result ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : !result ? (
        <p className="text-sm text-muted-foreground">
          No summary yet. Generate one before you call — it lists what the buyer has told us and what to ask.
        </p>
      ) : (
        <SummaryBody result={result} stale={gen.isPending} />
      )}
    </Panel>
  );
}

function SummaryBody({ result, stale }: { result: AiSummaryResult; stale: boolean }) {
  const s = result.summary;
  const conf = CONFIDENCE[s.confidence];
  const facts: [string, string | undefined][] = [
    ["Budget", s.budgetBand],
    ["Timeline", s.timeline],
    ["Fuel", s.fuelPreference],
  ];
  return (
    <div className={cn("space-y-4 transition-opacity", stale && "opacity-50")}>
      {result.status === "FALLBACK" && (
        <div role="status" className="flex items-start gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-sm">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium">AI unavailable — showing basic summary.</span>{" "}
            <span className="text-muted-foreground">Built from the form fields only; check details on the call.</span>
          </span>
        </div>
      )}
      {s.confidence === "low" && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">AI is unsure</span>
            {s.missingInfo.length > 0
              ? ` — ask the buyer about: ${s.missingInfo.join(", ")}.`
              : " — confirm the buyer’s needs on the call before relying on this."}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium", conf.cls)}>
          {conf.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {result.status === "FALLBACK" ? "Template" : result.model} · {formatStaffDateTime(result.createdAt)}
        </span>
      </div>

      <div>
        <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Needs</h4>
        {s.needs.length ? (
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm marker:text-muted-foreground">
            {s.needs.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Not stated</p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className={cn("mt-0.5 text-sm font-medium", !v && "font-normal text-muted-foreground")}>{v || "Unknown"}</dd>
          </div>
        ))}
      </dl>

      {s.missingInfo.length > 0 && (
        <div>
          <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Ask the buyer</h4>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {s.missingInfo.map((m, i) => (
              <li key={i} className="rounded-full border border-dashed px-2.5 py-0.5 text-xs">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">AI can be wrong. Prices always come from the price table, never from AI.</p>
    </div>
  );
}
