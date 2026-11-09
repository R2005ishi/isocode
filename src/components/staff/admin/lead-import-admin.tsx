"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CircleAlertIcon,
  DownloadIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  HistoryIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { csvCell } from "@/server/services/csv";
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  PORTAL_SUGGESTIONS,
  SAMPLE_CSV_HEADERS,
  type ImportRowIssue,
  type LeadImportResult,
  type LeadImportSummary,
} from "@/server/services/lead-import";
import { api, errorMessage } from "../api";
import { formatStaffDateTime } from "../labels";
import { EmptyState, ErrorState, PageHeader } from "../states";
import { useLookups } from "./shared";

const NO_SHOWROOM = "__none";
const importsKey = ["admin", "lead-imports"] as const;

type Picked = { name: string; text: string; size: number };

function downloadSample(
  models: { name: string; variants: { name: string }[] }[],
  showrooms: { name: string }[],
) {
  const m0 = models[0];
  const m1 = models[1] ?? m0;
  const s0 = showrooms[0]?.name ?? "";
  const rows = [
    SAMPLE_CSV_HEADERS,
    [
      "CD-100231",
      "Priya Sharma",
      "+91 98765 43210",
      "priya@example.com",
      "Lucknow",
      m0?.name ?? "",
      m0?.variants[0]?.name ?? "",
      s0,
      "Wants a weekend test drive",
      "08/11/2026 10:30",
    ],
    [
      "CD-100232",
      "Amit Verma",
      "09812345678",
      "",
      "Kanpur",
      m1?.name ?? "",
      "",
      "",
      'Asked for best on-road price, "exchange" offer',
      "2026-11-08 16:05",
    ],
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "portal-leads-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LeadImportAdmin() {
  const qc = useQueryClient();
  const lookups = useLookups();
  const history = useQuery({
    queryKey: importsKey,
    queryFn: () => api<LeadImportSummary[]>("/api/leads/import"),
  });

  const [portalName, setPortalName] = useState("");
  const [showroomId, setShowroomId] = useState(NO_SHOWROOM);
  const [file, setFile] = useState<Picked | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<LeadImportResult | null>(null);
  /** Settings the current preview was made with; Import is enabled only while they still match. */
  const [previewedFor, setPreviewedFor] = useState<string | null>(null);

  const settingsKey = `${portalName.trim().toLowerCase()}|${showroomId}|${file?.name}|${file?.size}`;

  const run = useMutation({
    mutationFn: (dryRun: boolean) =>
      api<LeadImportResult>("/api/leads/import", {
        method: "POST",
        body: {
          fileName: file!.name,
          portalName: portalName.trim(),
          csvText: file!.text,
          defaultShowroomId: showroomId === NO_SHOWROOM ? null : showroomId,
          dryRun,
        },
      }),
    onSuccess: (r) => {
      setResult(r);
      if (r.dryRun) {
        setPreviewedFor(settingsKey);
      } else {
        setPreviewedFor(null);
        toast.success(
          `Imported ${r.createdCount} lead${r.createdCount === 1 ? "" : "s"} from ${r.portalName}`,
        );
        qc.invalidateQueries({ queryKey: importsKey });
        qc.invalidateQueries({ queryKey: ["leads"] });
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function onPick(f: File | undefined) {
    setResult(null);
    setPreviewedFor(null);
    setFileError(null);
    if (!f) return setFile(null);
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") {
      setFile(null);
      return setFileError("Choose a .csv file (in Excel: File → Save As → CSV UTF-8).");
    }
    if (f.size > IMPORT_MAX_BYTES) {
      setFile(null);
      return setFileError("File is larger than 1 MB. Split it into smaller files.");
    }
    setFile({ name: f.name, size: f.size, text: await f.text() });
  }

  const canRun = !!file && portalName.trim().length >= 2 && !run.isPending;
  const previewFresh = previewedFor === settingsKey && result?.dryRun;
  const showrooms = lookups.data?.showrooms ?? [];

  return (
    <div>
      <PageHeader
        title="Import portal leads"
        description={`Upload a CSV export from a car portal. Leads land in the inbox as “Portal” leads and are auto-assigned by showroom and model. Up to ${IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows / 1 MB per file.`}
        actions={
          <Button
            variant="outline"
            onClick={() => downloadSample(lookups.data?.models ?? [], showrooms)}
            disabled={lookups.isPending}
          >
            <DownloadIcon /> Sample CSV
          </Button>
        }
      />

      <section className="bg-background rounded-xl border p-4 sm:p-5" aria-label="Import settings">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="portalName">Portal</Label>
            <Input
              id="portalName"
              list="portal-suggestions"
              placeholder="e.g. CarDekho"
              autoComplete="off"
              value={portalName}
              onChange={(e) => setPortalName(e.target.value)}
            />
            <datalist id="portal-suggestions">
              {PORTAL_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <p className="text-muted-foreground text-xs">
              Re-imports skip lead ids already imported from this portal.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaultShowroom">Default showroom</Label>
            <Select value={showroomId} onValueChange={setShowroomId}>
              <SelectTrigger id="defaultShowroom" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SHOWROOM}>None — use the CSV’s showroom / city</SelectItem>
                {showrooms.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Used for rows without a recognised showroom.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="csvFile">CSV file</Label>
            <Input
              id="csvFile"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onPick(e.target.files?.[0])}
              aria-invalid={!!fileError}
            />
            {fileError ? (
              <p className="text-destructive text-xs" role="alert">
                {fileError}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                {file
                  ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB`
                  : "Columns: name, phone (required), email, city, model, variant, showroom, remarks, lead id, date."}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => run.mutate(true)} disabled={!canRun}>
            {run.isPending && run.variables === true ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <EyeIcon />
            )}
            Preview
          </Button>
          <Button
            onClick={() => run.mutate(false)}
            disabled={!canRun || !previewFresh || result?.createdCount === 0}
          >
            {run.isPending && run.variables === false ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <UploadIcon />
            )}
            {previewFresh && result
              ? `Import ${result.createdCount} lead${result.createdCount === 1 ? "" : "s"}`
              : "Import"}
          </Button>
          {!previewFresh && file && portalName.trim().length >= 2 && (
            <p className="text-muted-foreground self-center text-xs">Preview first, then import.</p>
          )}
        </div>
      </section>

      {result && <ResultPanel result={result} />}

      <section className="mt-8" aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 flex items-center gap-2 text-base font-semibold">
          <HistoryIcon className="text-muted-foreground size-4" aria-hidden /> Past imports
        </h2>
        {history.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : (history.data ?? []).length === 0 ? (
          <EmptyState
            icon={FileSpreadsheetIcon}
            title="No imports yet"
            description="Imports you run appear here."
          />
        ) : (
          <div className="bg-background overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="pr-4">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data!.map((h) => (
                  <TableRow key={h.id} className="align-top">
                    <TableCell className="py-2.5 pl-4 whitespace-nowrap">
                      {formatStaffDateTime(h.createdAt)}
                    </TableCell>
                    <TableCell>{h.portalName}</TableCell>
                    <TableCell className="max-w-64">
                      <p className="truncate">{h.fileName}</p>
                      {h.errors.length > 0 && (
                        <details className="mt-1 text-xs">
                          <summary className="text-muted-foreground cursor-pointer">
                            {h.errors.length} skipped row{h.errors.length === 1 ? "" : "s"}
                          </summary>
                          <IssueList issues={h.errors} className="mt-1 max-h-48" />
                        </details>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{h.totalRows}</TableCell>
                    <TableCell className="text-right tabular-nums">{h.createdCount}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        h.skippedCount > 0 && "text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {h.skippedCount}
                    </TableCell>
                    <TableCell className="pr-4">{h.importedBy?.name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" }) {
  return (
    <div className="bg-background rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-700 dark:text-emerald-400",
          tone === "warn" && value > 0 && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function IssueList({ issues, className }: { issues: ImportRowIssue[]; className?: string }) {
  return (
    <ul className={cn("space-y-0.5 overflow-y-auto text-xs", className)}>
      {issues.map((e, i) => (
        <li key={`${e.row}-${i}`}>
          <span className="font-medium tabular-nums">Row {e.row}:</span> {e.reason}
        </li>
      ))}
    </ul>
  );
}

const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  city: "City",
  model: "Model",
  variant: "Variant",
  showroom: "Showroom",
  message: "Remarks",
  externalRef: "Lead id",
  createdAt: "Date",
};

function ResultPanel({ result: r }: { result: LeadImportResult }) {
  return (
    <section
      className="mt-6 space-y-4"
      aria-live="polite"
      aria-label={r.dryRun ? "Preview" : "Import result"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{r.dryRun ? "Preview" : "Import complete"}</h2>
        <Badge variant={r.dryRun ? "secondary" : "default"}>
          {r.dryRun ? "Nothing saved yet" : "Saved"}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {r.portalName} · {r.fileName}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:max-w-md">
        <Stat label="Rows" value={r.totalRows} />
        <Stat label={r.dryRun ? "Will create" : "Created"} value={r.createdCount} tone="good" />
        <Stat label="Skipped" value={r.skippedCount} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Columns matched:</span>
        {Object.entries(r.headerMap).map(([f, h]) => (
          <Badge key={f} variant="outline">
            {FIELD_LABEL[f] ?? f} ← “{h}”
          </Badge>
        ))}
        {r.ignoredHeaders.length > 0 && (
          <span className="text-muted-foreground">· ignored: {r.ignoredHeaders.join(", ")}</span>
        )}
      </div>

      {r.errors.length > 0 && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <CircleAlertIcon className="size-4" aria-hidden /> {r.errors.length} row
            {r.errors.length === 1 ? "" : "s"} {r.dryRun ? "will be" : "were"} skipped
          </p>
          <IssueList issues={r.errors} className="max-h-60" />
        </div>
      )}
      {r.warnings.length > 0 && (
        <details className="bg-background rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {r.warnings.length} warning{r.warnings.length === 1 ? "" : "s"} (row still imported;
            unknown values kept in the lead’s message)
          </summary>
          <IssueList issues={r.warnings} className="text-muted-foreground mt-2 max-h-60" />
        </details>
      )}

      {r.preview.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-sm">
            First {r.preview.length} valid row{r.preview.length === 1 ? "" : "s"}
          </p>
          <div className="bg-background overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Showroom</TableHead>
                  <TableHead>Lead id</TableHead>
                  <TableHead className="pr-4">Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.preview.map((p) => (
                  <TableRow
                    key={p.row}
                    className={cn(p.outcome === "skip" && "text-muted-foreground")}
                  >
                    <TableCell className="py-2 pl-4 tabular-nums">{p.row}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {p.phoneMasked}
                    </TableCell>
                    <TableCell>{[p.model, p.variant].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell>
                      {p.showroom ??
                        (p.city ? <span className="text-muted-foreground">{p.city}</span> : "—")}
                    </TableCell>
                    <TableCell className="text-xs">{p.externalRef ?? "—"}</TableCell>
                    <TableCell className="pr-4">
                      {p.outcome === "create" ? (
                        <Badge variant="secondary">{r.dryRun ? "Will create" : "Created"}</Badge>
                      ) : (
                        <span className="text-xs">Skip: {p.reason}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
