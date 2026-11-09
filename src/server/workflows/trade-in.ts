/**
 * Trade-in requests: a buyer offers their current car in exchange. Each request is a lead
 * (source TRADE_IN) with a TradeInRequest row, auto-assigned like an enquiry.
 * Mirrors createEnquiry in ./public.ts (opt-out lift, no duplicate blocking, same response shape).
 */
import { db } from "@/lib/db";
import { badRequest } from "@/lib/security/errors";
import type { SessionUser } from "@/lib/security/guard";
import { assignLead } from "@/server/services/assignment";
import { makeReference } from "@/server/services/ids";
import { formatINR, formatNumberIN } from "@/lib/format";
import { assertLeadAccess } from "./leads";
import { sendMock } from "./messaging";
import type { TradeInCreated, TradeInCreateInput, TradeInDetail } from "./trade-in.schema";

/** `TI-7K2Q9` — same alphabet/length as enquiry references, distinct prefix for staff. */
export function makeTradeInReference(): string {
  return makeReference("EN").replace(/^EN-/, "TI-");
}

export function tradeInAckBody(p: {
  locale: "en" | "hi";
  name: string;
  reference: string;
  car: string;
}): string {
  return p.locale === "hi"
    ? `नमस्ते ${p.name}, आपकी ${p.car} के एक्सचेंज (ट्रेड-इन) अनुरोध के लिए धन्यवाद। आपका संदर्भ नंबर ${p.reference} है। हमारे सलाहकार कार की जाँच और मूल्यांकन के लिए जल्द ही कॉल करेंगे। संदेश बंद करने के लिए STOP लिखें।`
    : `Hi ${p.name}, thanks for your trade-in request for your ${p.car}. Your reference is ${p.reference}. A consultant will call you shortly to arrange an inspection and valuation. Reply STOP to opt out.`;
}

/** One-line description of the car for activity notes / messages (no registration). */
export function tradeInCarLabel(t: {
  year: number;
  make: string;
  modelName: string;
  variantName?: string | null;
}): string {
  return [t.year, t.make, t.modelName, t.variantName].filter(Boolean).join(" ");
}

export async function createTradeInRequest(input: TradeInCreateInput): Promise<TradeInCreated> {
  // Resolve and sanity-check referenced catalogue rows (never trust client ids).
  let interestModelId = input.interestModelId ?? null;
  const interestVariantId = input.interestVariantId ?? null;
  let citySlug = input.citySlug ?? null;
  const fields: Record<string, string> = {};
  if (interestVariantId) {
    const v = await db.variant.findUnique({
      where: { id: interestVariantId },
      select: { modelId: true },
    });
    if (!v) fields.interestVariantId = "Unknown variant";
    else interestModelId = v.modelId;
  }
  if (interestModelId && !fields.interestVariantId) {
    const m = await db.model.findUnique({ where: { id: interestModelId }, select: { id: true } });
    if (!m) fields.interestModelId = "Unknown model";
  }
  if (input.showroomId) {
    const s = await db.showroom.findUnique({
      where: { id: input.showroomId },
      select: { id: true, cityId: true },
    });
    if (!s) fields.showroomId = "Unknown showroom";
    else if (s.cityId) {
      // The showroom decides the city.
      const c = await db.city.findUnique({ where: { id: s.cityId }, select: { slug: true } });
      if (c) citySlug = c.slug;
    }
  } else if (citySlug) {
    const c = await db.city.findUnique({ where: { slug: citySlug }, select: { slug: true } });
    if (!c) citySlug = null; // stale cookie value: drop it rather than fail the form
  }
  if (Object.keys(fields).length) throw badRequest("Please check the highlighted fields", fields);

  const reference = makeTradeInReference();
  const car = tradeInCarLabel(input);
  const now = new Date();
  return db.$transaction(async (tx) => {
    // A fresh, consented form submission lifts an earlier opt-out (same rule as enquiries).
    const { count: resubscribed } = await tx.optOut.deleteMany({ where: { phone: input.phone } });
    const lead = await tx.lead.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        source: "TRADE_IN",
        status: "NEW",
        locale: input.locale,
        interestModelId,
        interestVariantId,
        showroomId: input.showroomId ?? null,
        citySlug,
        message: input.message || null,
        consent: true,
        consentAt: now,
      },
    });
    await tx.tradeInRequest.create({
      data: {
        leadId: lead.id,
        make: input.make,
        modelName: input.modelName,
        variantName: input.variantName ?? null,
        year: input.year,
        km: input.km,
        owners: input.owners,
        fuel: input.fuel ?? null,
        registration: input.registration ?? null,
        expectedPrice: input.expectedPrice ?? null,
        condition: input.condition ?? null,
      },
    });
    const priceNote = input.expectedPrice ? `, expects ${formatINR(input.expectedPrice)}` : "";
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "CREATED",
        note: `Trade-in request ${reference}: ${car}, ${formatNumberIN(input.km)} km${priceNote}`,
      },
    });
    if (resubscribed > 0) {
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "NOTE",
          note: "Earlier opt-out lifted: buyer gave fresh consent on this form",
        },
      });
    }
    await assignLead(tx, lead.id, input.showroomId ?? null, interestModelId);
    await sendMock(
      {
        leadId: lead.id,
        channel: "WHATSAPP",
        to: input.phone,
        template: "trade_in_ack",
        body: tradeInAckBody({ locale: input.locale, name: input.name, reference, car }),
      },
      tx,
    );
    return { leadId: lead.id, reference };
  });
}

/** Staff: the trade-in attached to a lead, or null. Same access rule as the lead itself. */
export async function getTradeInForLead(
  user: SessionUser,
  leadId: string,
): Promise<TradeInDetail | null> {
  await assertLeadAccess(user, leadId);
  const row = await db.tradeInRequest.findUnique({
    where: { leadId },
    select: {
      id: true,
      make: true,
      modelName: true,
      variantName: true,
      year: true,
      km: true,
      owners: true,
      fuel: true,
      registration: true,
      expectedPrice: true,
      condition: true,
      createdAt: true,
    },
  });
  if (!row) return null;
  return { ...row, createdAt: row.createdAt.toISOString() };
}


// ─── Form options (public page) ──────────────────────────────────────────────

export type TradeInOptions = {
  showrooms: { id: string; name: string; address: string }[];
  models: { id: string; name: string; slug: string; variants: { id: string; name: string }[] }[];
};

/** Showrooms and active catalogue models/variants for the trade-in form selects. */
export async function listTradeInOptions(): Promise<TradeInOptions> {
  const [showrooms, models] = await Promise.all([
    db.showroom.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true },
    }),
    db.model.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        variants: {
          where: { isActive: true },
          orderBy: { exShowroomPrice: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
  ]);
  return { showrooms, models };
}
