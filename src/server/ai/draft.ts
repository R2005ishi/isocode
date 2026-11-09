import { db } from "@/lib/db";
import type { AiDraftResult, AiStatus, Locale, OnRoadBreakup, Slot } from "@/types/contracts";
import { getOnRoadPrice } from "@/server/services/pricing.repo";
import { PriceNotPublishedError } from "@/server/services/pricing";
import { getSlots } from "@/server/services/slots.repo";
import { istDateString } from "@/server/services/slots";
import { getProvider, AiNoKeyError, AiTimeoutError } from "./provider";
import {
  DRAFT_RETRY_INSTRUCTION,
  DRAFT_SYSTEM,
  buildDraftPrompt,
  type DraftFacts,
} from "./prompts";
import { findDiscountLanguage, findUnverifiedRupees } from "./guardrails";
import { buildFallbackDraft } from "./draft-template";
import { loadLeadContext } from "./lead-context";
import { TEMPLATE_MODEL } from "./summary";

// ASSUMPTION: price quoted in a draft defaults to Lucknow when the lead has no city (dealer's home city).
export const DEFAULT_CITY_SLUG = "lucknow";
// ASSUMPTION: propose slots from today and the next 3 days, at most 3, and none starting within 2 hours.
const SLOT_LOOKAHEAD_DAYS = 4;
const MAX_SLOTS = 3;
const MIN_LEAD_TIME_MS = 2 * 60 * 60_000;
/** Hard cap; the prompt asks for ≤ 90 words, anything far beyond that is treated as invalid. */
const MAX_WORDS = 140;

const DAY_MS = 86_400_000;

export function formatRupees(n: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
}

function formatSlotLabel(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Pick up to 3 free slots spread across days: first free slot of each day, then second ones.
 * Pure so it can be tested without a database.
 */
export function pickSlots(days: Slot[][], now: Date = new Date()): Slot[] {
  const free = days.map((d) =>
    d.filter((s) => s.available && new Date(s.start).getTime() - now.getTime() >= MIN_LEAD_TIME_MS),
  );
  const picked: Slot[] = [];
  for (let round = 0; picked.length < MAX_SLOTS && free.some((d) => d.length > round); round++) {
    for (const day of free) {
      if (picked.length >= MAX_SLOTS) break;
      if (day[round]) picked.push(day[round]);
    }
  }
  return picked.sort((a, b) => a.start.localeCompare(b.start));
}

async function findSlots(showroomId: string | null, variantId: string | null): Promise<Slot[]> {
  if (!showroomId || !variantId) return [];
  const demoCar = await db.demoCar.findFirst({
    where: { showroomId, variantId, isActive: true },
    select: { id: true },
  });
  if (!demoCar) return [];
  const now = new Date();
  const dates = Array.from({ length: SLOT_LOOKAHEAD_DAYS }, (_, i) =>
    istDateString(new Date(now.getTime() + i * DAY_MS)),
  );
  const days = await Promise.all(dates.map((d) => getSlots(showroomId, demoCar.id, d)));
  return pickSlots(days, now);
}

async function findPrice(
  variantId: string | null,
  citySlug: string,
): Promise<OnRoadBreakup | null> {
  if (!variantId) return null;
  try {
    const breakup = await getOnRoadPrice(variantId, citySlug);
    // An expired price row is not something we should quote to a buyer.
    return breakup.isExpired ? null : breakup;
  } catch (err) {
    if (!(err instanceof PriceNotPublishedError))
      console.error("[ai.draft] price lookup failed", err);
    return null;
  }
}

type Check =
  | { ok: true }
  | { ok: false; status: AiStatus; reason: keyof typeof DRAFT_RETRY_INSTRUCTION; detail: string[] };

/** Validates one model output against shape, language and both guardrails. */
export function checkDraft(text: string, locale: Locale, allowed: number[]): Check {
  const words = text.split(/\s+/).filter(Boolean).length;
  // Language check: Hindi drafts must be mostly Devanagari (car names stay in Latin script);
  // English drafts must be mostly Latin (a Devanagari name is fine).
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const devanagari = text.match(/[ऀ-ॿ]/g)?.length ?? 0;
  const mostlyHindi = letters > 0 && devanagari / letters >= 0.3;
  if (!text || words > MAX_WORDS || (locale === "hi") !== mostlyHindi) {
    return { ok: false, status: "FALLBACK", reason: "invalid_output", detail: [`words=${words}`] };
  }
  const discount = findDiscountLanguage(text);
  if (discount.length)
    return { ok: false, status: "BLOCKED", reason: "discount_language", detail: discount };
  const unverified = findUnverifiedRupees(text, allowed);
  if (unverified.length)
    return { ok: false, status: "BLOCKED", reason: "unverified_price", detail: unverified };
  return { ok: true };
}

function cleanOutput(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^"([\s\S]*)"$/, "$1")
    .trim();
}

export async function generateDraftForLead(
  leadId: string,
  actorId: string,
  requestedLocale?: Locale,
): Promise<AiDraftResult> {
  const ctx = await loadLeadContext(leadId);
  const locale: Locale = requestedLocale ?? ctx.locale;
  const citySlug = ctx.citySlug || DEFAULT_CITY_SLUG;

  const [slots, breakup] = await Promise.all([
    findSlots(ctx.showroomId, ctx.interestVariantId),
    findPrice(ctx.interestVariantId, citySlug),
  ]);
  const slotLabels = slots.map((s) => formatSlotLabel(s.start, locale));
  const allowed = breakup ? [...breakup.lines.map((l) => l.amount), breakup.total] : [];

  const facts: DraftFacts = {
    language: locale === "hi" ? "Hindi (Devanagari script)" : "English",
    buyerFirstName: ctx.firstName,
    consultantName: ctx.consultantName,
    showroomName: ctx.showroomName,
    carOfInterest: ctx.interest,
    slots: slotLabels,
    price: breakup
      ? {
          cityName: breakup.cityName,
          lines: breakup.lines.map((l) => ({ label: l.label, amount: formatRupees(l.amount) })),
          total: formatRupees(breakup.total),
          validUntil: formatDate(breakup.validUntil, locale),
        }
      : null,
  };
  const prompt = buildDraftPrompt(facts, ctx.message);
  const provider = getProvider();

  const attempts: { text: string; problem: string | null; detail?: string[] }[] = [];
  let text: string | null = null;
  let status: AiStatus = "OK";
  let reason: string | null = null;

  try {
    let lastFail: Extract<Check, { ok: false }> | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await provider.complete({
        system: DRAFT_SYSTEM,
        prompt: lastFail ? `${prompt}\n\n${DRAFT_RETRY_INSTRUCTION[lastFail.reason]}` : prompt,
        maxTokens: 2048,
      });
      const candidate = cleanOutput(raw);
      const check = checkDraft(candidate, locale, allowed);
      if (check.ok) {
        text = candidate;
        attempts.push({ text: candidate, problem: null });
        break;
      }
      attempts.push({ text: candidate, problem: check.reason, detail: check.detail });
      lastFail = check;
    }
    if (!text && lastFail) {
      status = lastFail.status;
      reason = lastFail.reason;
    }
  } catch (err) {
    status = "FALLBACK";
    reason =
      err instanceof AiTimeoutError
        ? "timeout"
        : err instanceof AiNoKeyError
          ? "no_api_key"
          : "provider_error";
    if (reason === "provider_error") console.error("[ai.draft] provider error", err);
  }

  if (!text) {
    text = buildFallbackDraft({
      locale,
      firstName: ctx.firstName,
      consultantName: ctx.consultantName,
      showroomName: ctx.showroomName,
      carOfInterest: ctx.interest,
      slotLabels,
      price: facts.price
        ? {
            cityName: facts.price.cityName,
            total: facts.price.total,
            validUntil: facts.price.validUntil,
          }
        : null,
    });
  }

  const model = status === "OK" ? (provider.model ?? provider.name) : TEMPLATE_MODEL;
  // Stored for audit; drafts are NEVER sent from here — a consultant edits and sends via /send.
  const row = await db.aiOutput.create({
    data: {
      leadId: ctx.id,
      kind: "DRAFT",
      input: {
        actorId,
        locale,
        citySlug,
        allowedAmounts: allowed,
        slots: slots.map((s, i) => ({ start: s.start, label: slotLabels[i] })),
        priceAvailable: !!breakup,
        prompt,
      },
      output: { text, attempts },
      model,
      status,
      reason,
    },
  });

  return {
    id: row.id,
    status,
    reason,
    text,
    locale,
    model,
    createdAt: row.createdAt.toISOString(),
  };
}
