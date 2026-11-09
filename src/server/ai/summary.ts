import { db } from "@/lib/db";
import {
  AiSummarySchema,
  type AiStatus,
  type AiSummary,
  type AiSummaryResult,
} from "@/types/contracts";
import { getProvider, AiNoKeyError, AiTimeoutError } from "./provider";
import { SUMMARY_RETRY_INSTRUCTION, SUMMARY_SYSTEM, buildSummaryPrompt } from "./prompts";
import { isSparse, loadLeadContext, type LeadContext } from "./lead-context";

export const TEMPLATE_MODEL = "template";

/** Strip ```json fences / surrounding prose and parse + validate against the contract schema. */
export function parseSummary(raw: string): AiSummary | null {
  let text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  text = text.slice(first, last + 1);
  try {
    const parsed = AiSummarySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Facts we know for certain from structured fields — the only "needs" allowed when there is no free text. */
export function knownFacts(ctx: LeadContext): string[] {
  const facts: string[] = [];
  if (ctx.interest) facts.push(`Interested in ${ctx.interest}`);
  if (ctx.source === "TEST_DRIVE") facts.push("Booked a test drive online");
  if (ctx.showroomName) facts.push(`Nearest showroom: ${ctx.showroomName}`);
  if (facts.length === 0) facts.push(`New ${ctx.source.toLowerCase()} enquiry`);
  return facts;
}

/** Deterministic summary from structured fields only. Used on any AI failure. */
export function fallbackSummary(ctx: LeadContext): AiSummary {
  const missing = ["Budget", "Purchase timeline"];
  if (!ctx.fuelOfInterest) missing.push("Fuel preference");
  if (!ctx.interest) missing.push("Model of interest");
  missing.push("Finance or cash purchase", "Trade-in of current car");
  return {
    needs: knownFacts(ctx),
    ...(ctx.fuelOfInterest ? { fuelPreference: `${ctx.fuelOfInterest} (chosen car)` } : {}),
    missingInfo: missing,
    confidence: "low",
  };
}

/**
 * With no buyer or consultant text the model has nothing to infer from, so anything beyond the
 * structured facts would be invented. Force low confidence and keep only known facts.
 */
export function enforceSparse(summary: AiSummary, ctx: LeadContext): AiSummary {
  const base = fallbackSummary(ctx);
  // Keep the model's "missing" items (listing unknowns can't invent anything); drop its needs,
  // budget and timeline, which on a sparse lead could only be guesses.
  const missingInfo = [...new Set([...base.missingInfo, ...summary.missingInfo])].slice(0, 8);
  return { ...base, missingInfo, confidence: "low" };
}

export async function generateSummaryForLead(
  leadId: string,
  actorId: string,
): Promise<AiSummaryResult> {
  const ctx = await loadLeadContext(leadId);
  const provider = getProvider();
  const prompt = buildSummaryPrompt(
    {
      source: ctx.source,
      locale: ctx.locale,
      status: ctx.status,
      interest: ctx.interest,
      fuelOfInterest: ctx.fuelOfInterest,
      showroomName: ctx.showroomName,
      city: ctx.citySlug,
    },
    ctx.message,
    ctx.notes,
  );

  const attempts: { raw: string; valid: boolean }[] = [];
  let summary: AiSummary | null = null;
  let status: AiStatus = "OK";
  let reason: string | null = null;

  try {
    for (let attempt = 0; attempt < 2 && !summary; attempt++) {
      const raw = await provider.complete({
        system: SUMMARY_SYSTEM,
        prompt: attempt === 0 ? prompt : `${prompt}\n\n${SUMMARY_RETRY_INSTRUCTION}`,
        maxTokens: 1024,
      });
      summary = parseSummary(raw);
      attempts.push({ raw, valid: !!summary });
    }
    if (!summary) {
      status = "FALLBACK";
      reason = "invalid_output";
    }
  } catch (err) {
    status = "FALLBACK";
    reason =
      err instanceof AiTimeoutError
        ? "timeout"
        : err instanceof AiNoKeyError
          ? "no_api_key"
          : "provider_error";
    if (reason === "provider_error") console.error("[ai.summary] provider error", err);
  }

  if (!summary) {
    summary = fallbackSummary(ctx);
  } else if (isSparse(ctx)) {
    summary = enforceSparse(summary, ctx);
    reason = "sparse_lead";
  }

  const model = status === "OK" ? (provider.model ?? provider.name) : TEMPLATE_MODEL;
  const row = await db.aiOutput.create({
    data: {
      leadId: ctx.id,
      kind: "SUMMARY",
      input: { actorId, prompt, sparse: isSparse(ctx) },
      output: { summary, attempts },
      model,
      status,
      reason,
    },
  });

  return {
    id: row.id,
    status,
    reason,
    summary,
    model,
    createdAt: row.createdAt.toISOString(),
  };
}
