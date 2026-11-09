/**
 * Mock outbound messaging (WhatsApp / SMS). Nothing leaves the server: each message is written to
 * MessageLog and the console. Every send honours the DPDP opt-out register.
 */
import type { MessageChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiErr } from "@/lib/security/errors";

type Client = Prisma.TransactionClient | typeof db;

export type MockMessage = {
  leadId: string | null;
  channel: MessageChannel;
  to: string;
  template: string;
  body: string;
};

export async function isOptedOut(phone: string, client: Client = db): Promise<boolean> {
  const row = await client.optOut.findUnique({ where: { phone }, select: { id: true } });
  return !!row;
}

/** Writes a MessageLog row; throws 409 OPTED_OUT if the recipient or lead has opted out. */
export async function sendMock(msg: MockMessage, client: Client = db) {
  const lead = msg.leadId
    ? await client.lead.findUnique({ where: { id: msg.leadId }, select: { optedOut: true } })
    : null;
  if (lead?.optedOut || (await isOptedOut(msg.to, client))) {
    throw new ApiErr(
      409,
      "OPTED_OUT",
      "This buyer has opted out of messages. Call only if they ask you to.",
    );
  }
  const row = await client.messageLog.create({ data: msg });
  console.info(`[mock:${msg.channel}] to=${msg.to} template=${msg.template} :: ${msg.body}`);
  return row;
}

const istFmt = (locale: "en" | "hi") =>
  new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export function formatIst(d: Date, locale: "en" | "hi" = "en"): string {
  return istFmt(locale).format(d);
}

export function testDriveAckBody(p: {
  locale: "en" | "hi";
  name: string;
  reference: string;
  slotStart: Date;
  showroomName: string;
  carLabel: string;
}): string {
  const when = formatIst(p.slotStart, p.locale);
  return p.locale === "hi"
    ? `नमस्ते ${p.name}, आपकी टेस्ट ड्राइव बुक हो गई है।\nबुकिंग ID: ${p.reference}\nसमय: ${when} (IST)\nशोरूम: ${p.showroomName}\nकार: ${p.carLabel}\nहमारे सलाहकार जल्द ही आपसे संपर्क करेंगे। संदेश बंद करने के लिए STOP लिखें।`
    : `Hi ${p.name}, your test drive is booked.\nBooking ID: ${p.reference}\nWhen: ${when} (IST)\nShowroom: ${p.showroomName}\nCar: ${p.carLabel}\nA consultant will call you shortly. Reply STOP to opt out.`;
}

export function enquiryAckBody(p: {
  locale: "en" | "hi";
  name: string;
  reference: string;
}): string {
  return p.locale === "hi"
    ? `नमस्ते ${p.name}, Brand X से संपर्क करने के लिए धन्यवाद। आपका संदर्भ नंबर ${p.reference} है। हमारे सलाहकार जल्द ही आपको कॉल करेंगे। संदेश बंद करने के लिए STOP लिखें।`
    : `Hi ${p.name}, thanks for contacting Brand X. Your reference is ${p.reference}. A consultant will call you shortly. Reply STOP to opt out.`;
}
