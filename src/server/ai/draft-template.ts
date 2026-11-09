/**
 * Deterministic fallback reply, built in code from verified data only (names, real free slots,
 * admin-table price). Used whenever the AI is unavailable, times out, or its draft is blocked.
 * It must itself pass both guardrails — see draft-template.test.ts.
 */
import type { Locale } from "@/types/contracts";

export type TemplateInput = {
  locale: Locale;
  firstName: string;
  consultantName: string | null;
  showroomName: string | null;
  carOfInterest: string | null;
  slotLabels: string[];
  price: { cityName: string; total: string; validUntil: string } | null;
};

/** Slot labels contain commas ("Sat, 8 Nov, 10:00 am"), so separate them with semicolons. */
function joinOr(items: string[], or: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("; ")} ${or} ${items[items.length - 1]}`;
}

/** Seeded showroom names may already include the brand ("Brand X Gomti Nagar"). */
function showroomLabel(name: string): string {
  return /brand x/i.test(name) ? name : `Brand X ${name}`;
}

export function buildFallbackDraft(t: TemplateInput): string {
  return t.locale === "hi" ? hindi(t) : english(t);
}

function english(t: TemplateInput): string {
  const who = t.consultantName
    ? `this is ${t.consultantName} from ${t.showroomName ? showroomLabel(t.showroomName) : "Brand X"}`
    : `this is the Brand X team${t.showroomName ? ` at ${showroomLabel(t.showroomName)}` : ""}`;
  const parts = [
    `Hi ${t.firstName}, ${who}.`,
    `Thank you for your interest in ${t.carOfInterest ? `the ${t.carOfInterest}` : "Brand X"}.`,
    t.slotLabels.length
      ? `I can keep a test drive ready for you on ${joinOr(t.slotLabels, "or")}. Which suits you?`
      : "When would you like to come in for a test drive? Just reply with a day and time.",
  ];
  if (t.price) {
    parts.push(
      `The on-road price in ${t.price.cityName} is ${t.price.total} (valid till ${t.price.validUntil}; prices may change).`,
    );
  }
  parts.push("Happy to answer any questions here.");
  return parts.join(" ");
}

function hindi(t: TemplateInput): string {
  const from = t.showroomName ? showroomLabel(t.showroomName) : "Brand X";
  const who = t.consultantName ? `मैं ${t.consultantName}, ${from} से` : `हम ${from} से`;
  const parts = [
    `नमस्ते ${t.firstName} जी, ${who}।`,
    `${t.carOfInterest ?? "Brand X"} में रुचि के लिए धन्यवाद।`,
    t.slotLabels.length
      ? `टेस्ट ड्राइव के लिए ये समय खाली हैं: ${joinOr(t.slotLabels, "या")}। आपके लिए कौन-सा ठीक रहेगा?`
      : "टेस्ट ड्राइव के लिए आपको कौन-सा दिन और समय ठीक लगेगा? बस जवाब में बता दीजिए।",
  ];
  if (t.price) {
    parts.push(
      `${t.price.cityName} में ऑन-रोड कीमत ${t.price.total} है (${t.price.validUntil} तक मान्य; कीमतें बदल सकती हैं)।`,
    );
  }
  parts.push("कोई भी सवाल हो तो यहीं पूछिए।");
  return parts.join(" ");
}
