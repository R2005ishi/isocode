import { db } from "@/lib/db";
import {
  computeAiQuality,
  editBucket,
  editRatio,
  type AiQuality,
  type DraftRow,
  type EditBucket,
} from "@/server/services/ai-quality";

export type RecentDraft = {
  id: string;
  leadId: string | null;
  leadName: string;
  createdAt: Date;
  status: DraftRow["status"];
  reason: string | null;
  attempts: number;
  sent: boolean;
  bucket: EditBucket | null;
  editPct: number | null;
};

export type AiQualityPage = {
  windowDays: number;
  quality: AiQuality;
  summaries: { ok: number; fallback: number };
  recent: RecentDraft[];
};

function draftText(output: unknown): string {
  const o = output as { text?: unknown } | null;
  return typeof o?.text === "string" ? o.text : "";
}

function attemptCount(output: unknown, status: DraftRow["status"]): number {
  const a = (output as { attempts?: unknown } | null)?.attempts;
  if (Array.isArray(a)) return a.length;
  return status === "OK" ? 1 : 0; // older rows without recorded attempts
}

/** Read-only aggregate for /admin/ai over the last `windowDays`. */
export async function getAiQuality(now = new Date(), windowDays = 30): Promise<AiQualityPage> {
  const since = new Date(now.getTime() - windowDays * 86_400_000);
  const [drafts, summaryCounts] = await Promise.all([
    db.aiOutput.findMany({
      where: { kind: "DRAFT", createdAt: { gte: since } },
      select: {
        id: true,
        leadId: true,
        status: true,
        reason: true,
        output: true,
        editedText: true,
        sentAt: true,
        createdAt: true,
        lead: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.aiOutput.groupBy({
      by: ["status"],
      where: { kind: "SUMMARY", createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const rows: DraftRow[] = drafts.map((d) => ({
    status: d.status,
    reason: d.reason,
    text: draftText(d.output),
    attempts: attemptCount(d.output, d.status),
    sentText: d.sentAt ? (d.editedText ?? draftText(d.output)) : null,
  }));

  const recent: RecentDraft[] = drafts.slice(0, 12).map((d, i) => {
    const r = rows[i];
    const ratio = r.sentText !== null ? editRatio(r.text, r.sentText) : null;
    return {
      id: d.id,
      leadId: d.leadId,
      leadName: d.lead?.name ?? "Deleted lead",
      createdAt: d.createdAt,
      status: d.status,
      reason: d.reason,
      attempts: r.attempts,
      sent: r.sentText !== null,
      bucket: ratio === null ? null : editBucket(ratio),
      editPct: ratio === null ? null : Math.round(ratio * 100),
    };
  });

  const count = (s: string) => summaryCounts.find((c) => c.status === s)?._count._all ?? 0;
  return {
    windowDays,
    quality: computeAiQuality(rows),
    summaries: { ok: count("OK"), fallback: count("FALLBACK") + count("BLOCKED") },
    recent,
  };
}
