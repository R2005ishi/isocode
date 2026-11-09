/**
 * AI draft quality metrics. [client-safe] — pure.
 *
 * Shows how the AI behaves when it is wrong or unsure, from what is already stored on each
 * AiOutput row: the draft text and its attempts, the status/reason, and the text the consultant
 * actually sent (`editedText`). Nothing here calls the AI.
 */

/** How much the consultant changed a draft before sending. */
export type EditBucket = "UNEDITED" | "LIGHT" | "HEAVY";

/** ASSUMPTION: up to 25 % of words changed counts as a light edit; more is a heavy rewrite. */
export const LIGHT_EDIT_MAX = 0.25;

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Word-level Levenshtein distance (insert/delete/substitute = 1). */
export function wordEditDistance(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[y.length];
}

/** Share of the draft's words that changed, 0..1 (capped). Whitespace-only changes count as 0. */
export function editRatio(draft: string, sent: string): number {
  const base = Math.max(words(draft).length, 1);
  return Math.min(1, wordEditDistance(draft, sent) / base);
}

export function editBucket(ratio: number): EditBucket {
  if (ratio === 0) return "UNEDITED";
  return ratio <= LIGHT_EDIT_MAX ? "LIGHT" : "HEAVY";
}

export type DraftRow = {
  status: "OK" | "FALLBACK" | "BLOCKED";
  reason: string | null;
  /** Text shown to the consultant (AI text, or the safe template on BLOCKED/FALLBACK). */
  text: string;
  /** Number of AI attempts recorded (2 = the AI broke a rule once and fixed it on retry). */
  attempts: number;
  sentText: string | null;
};

export type AiQuality = {
  drafts: number;
  /** AI text passed every check on the first try. */
  okFirstTry: number;
  /** AI broke a rule, was told why, and the retry passed. */
  okAfterRetry: number;
  /** AI output rejected twice → safe template used instead. Keyed by reason. */
  blocked: Record<string, number>;
  /** AI unavailable or unusable → template. Keyed by reason. */
  fallback: Record<string, number>;
  sent: number;
  edits: Record<EditBucket, number>;
  /** Mean share of words changed across sent drafts, 0..100, or null when none were sent. */
  avgEditPct: number | null;
};

export function computeAiQuality(rows: DraftRow[]): AiQuality {
  const q: AiQuality = {
    drafts: rows.length,
    okFirstTry: 0,
    okAfterRetry: 0,
    blocked: {},
    fallback: {},
    sent: 0,
    edits: { UNEDITED: 0, LIGHT: 0, HEAVY: 0 },
    avgEditPct: null,
  };
  let ratioSum = 0;
  for (const r of rows) {
    const reason = r.reason ?? "unknown";
    if (r.status === "OK") {
      if (r.attempts > 1) q.okAfterRetry++;
      else q.okFirstTry++;
    } else if (r.status === "BLOCKED") {
      q.blocked[reason] = (q.blocked[reason] ?? 0) + 1;
    } else {
      q.fallback[reason] = (q.fallback[reason] ?? 0) + 1;
    }
    if (r.sentText !== null) {
      const ratio = editRatio(r.text, r.sentText);
      q.sent++;
      q.edits[editBucket(ratio)]++;
      ratioSum += ratio;
    }
  }
  if (q.sent > 0) q.avgEditPct = Math.round((ratioSum / q.sent) * 100);
  return q;
}

/** Plain-English labels for stored reason codes (src/server/ai). */
export const AI_REASON_LABEL: Record<string, string> = {
  discount_language: "Mentioned a discount",
  unverified_price: "Quoted a price not in the price table",
  invalid_output: "Too long or malformed",
  timeout: "AI timed out",
  no_api_key: "AI not configured",
  provider_error: "AI service error",
  unknown: "Unknown",
};
