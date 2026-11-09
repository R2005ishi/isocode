/**
 * Public surface of the AI module (see docs/INTERFACES.md). API routes import only from here.
 * Throws AiLeadNotFoundError (status 404, code NOT_FOUND) when the lead does not exist.
 * Access control is the caller's job — these functions assume the actor may see the lead.
 */
import type { AiDraftResult, AiSummaryResult, Locale, PriceBandResult } from "@/types/contracts";
import { generateSummaryForLead } from "./summary";
import { generateDraftForLead } from "./draft";
import { priceBandFor } from "./price-band";

export { AiLeadNotFoundError } from "./lead-context";

export function generateSummary(leadId: string, actorId: string): Promise<AiSummaryResult> {
  return generateSummaryForLead(leadId, actorId);
}

export function generateDraft(
  leadId: string,
  actorId: string,
  locale?: Locale,
): Promise<AiDraftResult> {
  return generateDraftForLead(leadId, actorId, locale);
}

export function priceBand(modelName: string, year: number, km: number): Promise<PriceBandResult> {
  return priceBandFor(modelName, year, km);
}
