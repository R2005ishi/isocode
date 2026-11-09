import { db } from "@/lib/db";
import { redactContactDetails } from "./prompts";

/** Thrown when the lead id does not exist. API routes map this to 404 NOT_FOUND. */
export class AiLeadNotFoundError extends Error {
  readonly status = 404;
  readonly code = "NOT_FOUND" as const;
  constructor(leadId: string) {
    super(`Lead ${leadId} not found`);
    this.name = "AiLeadNotFoundError";
  }
}

/** Activity types whose notes are written by a human about the buyer (others are system events). */
const HUMAN_NOTE_TYPES = new Set(["NOTE", "CONTACTED"]);

export type LeadContext = {
  id: string;
  firstName: string;
  source: string;
  status: string;
  locale: "en" | "hi";
  citySlug: string | null;
  showroomId: string | null;
  showroomName: string | null;
  consultantName: string | null;
  interestVariantId: string | null;
  /** e.g. "Model H ZX Automatic Petrol" or "Used Model C VX Diesel (2022)". */
  interest: string | null;
  fuelOfInterest: string | null;
  /** Buyer message with phones/emails redacted; null when empty. */
  message: string | null;
  /** Human-written activity notes, redacted. */
  notes: string[];
};

const FUEL_LABEL: Record<string, string> = {
  PETROL: "Petrol",
  DIESEL: "Diesel",
  CNG: "CNG",
  ELECTRIC: "Electric",
  HYBRID: "Hybrid",
};

function titleCase(s: string): string {
  return FUEL_LABEL[s] ?? s.charAt(0) + s.slice(1).toLowerCase();
}

/**
 * Loads only what the AI needs. Phone and email are deliberately NOT selected —
 * they never reach the LLM (data minimisation).
 */
export async function loadLeadContext(leadId: string): Promise<LeadContext> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      source: true,
      status: true,
      locale: true,
      citySlug: true,
      message: true,
      showroomId: true,
      interestVariantId: true,
      showroom: { select: { name: true } },
      assignedTo: { select: { name: true } },
      interestModel: { select: { name: true } },
      interestVariant: {
        select: { name: true, fuel: true, transmission: true, model: { select: { name: true } } },
      },
      interestUsedCar: { select: { modelName: true, variantName: true, fuel: true, year: true } },
      activities: {
        select: { type: true, note: true },
        orderBy: { createdAt: "asc" },
        take: 30,
      },
    },
  });
  if (!lead) throw new AiLeadNotFoundError(leadId);

  let interest: string | null = null;
  let fuelOfInterest: string | null = null;
  if (lead.interestVariant) {
    interest = `${lead.interestVariant.model.name} ${lead.interestVariant.name}`;
    fuelOfInterest = titleCase(lead.interestVariant.fuel);
  } else if (lead.interestUsedCar) {
    const u = lead.interestUsedCar;
    interest = `Used ${u.modelName} ${u.variantName} (${u.year})`;
    fuelOfInterest = titleCase(u.fuel);
  } else if (lead.interestModel) {
    interest = lead.interestModel.name;
  }

  const message = lead.message?.trim() ? redactContactDetails(lead.message.trim()) : null;
  const notes = lead.activities
    .filter((a) => HUMAN_NOTE_TYPES.has(a.type) && a.note.trim())
    .map((a) => redactContactDetails(a.note.trim()));

  return {
    id: lead.id,
    firstName: lead.name.trim().split(/\s+/)[0] || lead.name,
    source: lead.source,
    status: lead.status,
    locale: lead.locale,
    citySlug: lead.citySlug,
    showroomId: lead.showroomId,
    showroomName: lead.showroom?.name ?? null,
    consultantName: lead.assignedTo?.name ?? null,
    interestVariantId: lead.interestVariantId,
    interest,
    fuelOfInterest,
    message,
    notes,
  };
}

/** True when the lead has no buyer- or consultant-written text — the AI has nothing to infer from. */
export function isSparse(ctx: LeadContext): boolean {
  return !ctx.message && ctx.notes.length === 0;
}
