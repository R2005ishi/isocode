"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BellOffIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  SendIcon,
  ShieldAlertIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AiDraftResult, Locale, SendResult } from "@/types/contracts";
import { api, errorMessage } from "../api";
import { leadKey } from "./use-lead";
import { Panel } from "./panel";

const MIN_LEN = 5; // SendSchema.text min
const MAX_LEN = 1500; // SendSchema.text max

function draftBadge(d: AiDraftResult): { label: string; cls: string } {
  if (d.status === "BLOCKED") {
    const label =
      d.reason === "discount_language"
        ? "Blocked: discount language"
        : d.reason === "unverified_price"
          ? "Blocked: unverified price"
          : "Blocked by safety check";
    return { label, cls: "border-red-600/30 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300" };
  }
  if (d.status === "FALLBACK")
    return { label: "Fallback template", cls: "border-border bg-muted text-foreground" };
  return { label: "AI draft", cls: "border-sky-600/25 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-300" };
}

export function AiDraftPanel({
  leadId,
  leadLocale,
  latestDraft,
  optedOut,
  buyerName,
  phone,
}: {
  leadId: string;
  leadLocale: Locale;
  latestDraft: AiDraftResult | null;
  optedOut: boolean;
  buyerName: string;
  phone: string;
}) {
  const qc = useQueryClient();
  const [locale, setLocale] = useState<Locale>(latestDraft?.locale ?? leadLocale);
  const [draft, setDraft] = useState<AiDraftResult | null>(latestDraft);
  const [text, setText] = useState(latestDraft?.text ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const gen = useMutation({
    mutationFn: () => api<AiDraftResult>(`/api/leads/${leadId}/ai/draft`, { method: "POST", body: { locale } }),
    onSuccess: (d) => {
      setDraft(d);
      setText(d.text);
      qc.invalidateQueries({ queryKey: leadKey(leadId) });
      if (d.status === "BLOCKED") toast.warning("The AI draft broke a safety rule, so a safe template was used.");
      else if (d.status === "FALLBACK") toast.warning("AI unavailable — a template reply was used.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const send = useMutation({
    mutationFn: () =>
      api<SendResult>(`/api/leads/${leadId}/send`, {
        method: "POST",
        body: { aiOutputId: draft?.id, text: text.trim(), channel: "WHATSAPP" },
      }),
    onSuccess: () => {
      setConfirmOpen(false);
      // Clear the composer so the same reply can't be sent twice by accident.
      setDraft(null);
      setText("");
      toast.success(`WhatsApp (mock) sent to ${buyerName} — logged to the timeline.`);
      qc.invalidateQueries({ queryKey: leadKey(leadId) });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const trimmed = text.trim();
  const tooShort = trimmed.length < MIN_LEN;
  const tooLong = trimmed.length > MAX_LEN;
  const edited = !!draft && trimmed !== draft.text.trim();
  const badge = draft ? draftBadge(draft) : null;

  return (
    <Panel
      icon={MessageSquareTextIcon}
      title="First reply"
      description="AI drafts it, you edit it, then send."
      action={
        <div className="flex items-center gap-2">
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger size="sm" className="w-28" aria-label="Draft language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">हिन्दी</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant={draft ? "outline" : "default"} onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            <span className="hidden sm:inline">{gen.isPending ? "Drafting…" : draft ? "Regenerate" : "Generate draft"}</span>
            <span className="sm:hidden">{gen.isPending ? "…" : draft ? "Redo" : "Draft"}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {optedOut && (
          <div role="status" className="flex items-start gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
            <BellOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            This buyer opted out of messages. Sending is disabled.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {badge && (
            <span className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium", badge.cls)}>
              {draft?.status === "BLOCKED" && <ShieldAlertIcon className="size-3.5" aria-hidden />}
              {badge.label}
            </span>
          )}
          {edited && <span className="text-xs text-muted-foreground">Edited by you</span>}
        </div>
        {draft?.status === "BLOCKED" && (
          <p className="text-xs text-muted-foreground">
            The AI’s text was replaced with the safe template below because it{" "}
            {draft.reason === "unverified_price" ? "quoted a price not in the price table" : "used discount language"}.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="reply-text" className="sr-only">
            Reply text
          </Label>
          <Textarea
            id="reply-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={gen.isPending ? "Drafting…" : "Generate a draft, or write your reply here."}
            className={cn("min-h-40 bg-background text-sm leading-relaxed", gen.isPending && "opacity-60")}
            disabled={gen.isPending}
            aria-invalid={tooLong}
            lang={locale}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Review before sending. Never promise discounts.</span>
            <span className={cn("tabular-nums", tooLong && "text-destructive")}>
              {trimmed.length}/{MAX_LEN}
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <a href={`tel:${phone}`} className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline sm:text-left">
            Prefer to call? {phone}
          </a>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={optedOut || tooShort || tooLong || send.isPending}
            className="h-9"
          >
            <SendIcon /> Send via WhatsApp (mock)
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => !send.isPending && setConfirmOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send this WhatsApp message?</DialogTitle>
            <DialogDescription>
              To {buyerName} ({phone}). This is a mock send — it is logged, not delivered.
            </DialogDescription>
          </DialogHeader>
          <blockquote
            lang={locale}
            className="max-h-72 overflow-y-auto rounded-lg border-l-4 border-emerald-600 bg-muted/60 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
          >
            {trimmed}
          </blockquote>
          <p className="text-xs text-muted-foreground">Check there are no discounts or prices that aren’t in the price table.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={send.isPending}>
              Keep editing
            </Button>
            <Button onClick={() => send.mutate()} disabled={send.isPending}>
              {send.isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              {send.isPending ? "Sending…" : "Send now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
