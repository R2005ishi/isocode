/* eslint-disable @typescript-eslint/no-explicit-any -- JSON response bodies are asserted loosely in tests */
/**
 * Route-handler tests against the real test DB (brandx_test).
 * Run: `npx vitest run tests/unit/api` (needs TEST_DATABASE_URL in env or .env; migrates + seeds it).
 */
import { resetTestDb } from "./setup"; // must be first: sets DATABASE_URL to the test DB
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resetRateLimits } from "@/lib/security/rate-limit";
import * as adminModels from "@/app/api/admin/models/route";
import * as adminModel from "@/app/api/admin/models/[id]/route";
import * as adminUsedCars from "@/app/api/admin/used-cars/route";
import * as adminUsers from "@/app/api/admin/users/route";
import * as adminUser from "@/app/api/admin/users/[id]/route";
import * as adminPrices from "@/app/api/admin/prices/route";
import * as consultants from "@/app/api/consultants/route";
import * as leads from "@/app/api/leads/route";
import * as lead from "@/app/api/leads/[id]/route";
import * as contact from "@/app/api/leads/[id]/contact/route";
import * as send from "@/app/api/leads/[id]/send/route";
import * as optout from "@/app/api/optout/route";
import * as price from "@/app/api/price/route";
import * as priceBand from "@/app/api/used-cars/[id]/price-band/route";
import * as slots from "@/app/api/slots/route";
import * as testDrives from "@/app/api/test-drives/route";
import * as cronEscalate from "@/app/api/cron/escalate/route";

const BASE = "http://localhost/api";
let ipCounter = 0;

function req(path: string, init: { method?: string; body?: unknown; ip?: string } = {}) {
  return new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": init.ip ?? `10.0.0.${++ipCounter % 250}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const users: Record<string, string> = {};
function signInAs(key: string | null) {
  vi.mocked(auth).mockResolvedValue((key ? { user: { id: users[key] } } : null) as never);
}

async function json(res: Response) {
  return { status: res.status, body: (await res.json()) as any };
}

/** Future slot on the 45-minute grid from 10:00 IST. */
function istSlot(daysAhead: number, k: number): Date {
  const ist = new Date(Date.now() + 330 * 60_000);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + daysAhead, 4, 30) +
      k * 45 * 60_000,
  );
}

beforeAll(async () => {
  resetTestDb();
  for (const u of await db.user.findMany({ select: { id: true, email: true } })) {
    users[u.email.split("@")[0]!.split(".")[0]!] = u.id;
  }
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(() => {
  resetRateLimits();
  signInAs(null);
});

async function leadByPhone(phone: string) {
  return db.lead.findFirstOrThrow({ where: { phone }, orderBy: { createdAt: "desc" } });
}

describe("authentication & roles", () => {
  it("401 when not signed in", async () => {
    const r = await json(await leads.GET(req("/leads"), undefined));
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("403 for a buyer on the staff inbox", async () => {
    signInAs("buyer1");
    const r = await json(await leads.GET(req("/leads"), undefined));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("FORBIDDEN");
  });

  it("403 for a consultant on admin routes", async () => {
    signInAs("asha");
    expect((await adminUsers.GET(req("/admin/users"), undefined)).status).toBe(403);
    expect((await adminModels.GET(req("/admin/models"), undefined)).status).toBe(403);
  });

  it("used-car manager: used-cars admin yes, other admin routes no", async () => {
    signInAs("ucm");
    expect((await adminModels.GET(req("/admin/models"), undefined)).status).toBe(403);
    expect((await adminUsedCars.GET(req("/admin/used-cars"), undefined)).status).toBe(200);
  });

  it("deactivated users lose access immediately even with a valid session", async () => {
    await db.user.update({ where: { id: users.imran }, data: { isActive: false } });
    signInAs("imran");
    expect((await leads.GET(req("/leads"), undefined)).status).toBe(401);
    await db.user.update({ where: { id: users.imran }, data: { isActive: true } });
  });

  it("price band: consultant 403, used-car manager 200", async () => {
    const car = await db.usedCar.findUniqueOrThrow({ where: { stockId: "UC-1182" } });
    signInAs("asha");
    expect((await priceBand.GET(req(`/used-cars/${car.id}/price-band`), ctx(car.id))).status).toBe(
      403,
    );
    signInAs("ucm");
    const r = await json(await priceBand.GET(req(`/used-cars/${car.id}/price-band`), ctx(car.id)));
    expect(r.status).toBe(200);
    expect(typeof r.body.ok).toBe("boolean");
  });
});

describe("lead access control", () => {
  it("consultant sees only their own leads, with masked phones", async () => {
    signInAs("asha");
    const r = await json(await leads.GET(req("/leads?scope=all"), undefined));
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    for (const l of r.body) {
      expect(l.assignedTo.id).toBe(users.asha);
      expect(l.phoneMasked).toMatch(/•/);
      expect(l).not.toHaveProperty("phone");
    }
  });

  it("admin with scope=all sees everyone's leads; SLA filter works", async () => {
    signInAs("admin");
    const all = await json(await leads.GET(req("/leads?scope=all"), undefined));
    expect(new Set(all.body.map((l: any) => l.assignedTo?.id)).size).toBeGreaterThan(2);
    const red = await json(await leads.GET(req("/leads?scope=all&sla=RED"), undefined));
    expect(red.body.length).toBeGreaterThan(0);
    expect(red.body.every((l: any) => l.sla === "RED")).toBe(true);
  });

  it("400 on an invalid query param", async () => {
    signInAs("asha");
    const r = await json(await leads.GET(req("/leads?status=BOGUS"), undefined));
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION");
  });

  it("403 when a consultant opens someone else's lead; 200 for their own", async () => {
    const ravis = await leadByPhone("9800000033");
    const ashas = await leadByPhone("9800000031");
    signInAs("asha");
    const denied = await json(await lead.GET(req(`/leads/${ravis.id}`), ctx(ravis.id)));
    expect(denied.status).toBe(403);
    expect(
      (
        await contact.POST(
          req(`/leads/${ravis.id}/contact`, { method: "POST", body: {} }),
          ctx(ravis.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await send.POST(
          req(`/leads/${ravis.id}/send`, { method: "POST", body: { text: "Hello there" } }),
          ctx(ravis.id),
        )
      ).status,
    ).toBe(403);

    const ok = await json(await lead.GET(req(`/leads/${ashas.id}`), ctx(ashas.id)));
    expect(ok.status).toBe(200);
    expect(ok.body.phone).toBe("9800000031");
    expect(ok.body.activities.length).toBeGreaterThan(0);
  });

  it("404 for an unknown lead", async () => {
    signInAs("admin");
    expect((await lead.GET(req("/leads/nope"), ctx("nope"))).status).toBe(404);
  });

  it("contact sets firstContactAt and moves NEW → CONTACTED", async () => {
    const l = await leadByPhone("9800000042");
    signInAs("asha");
    const r = await json(
      await contact.POST(
        req(`/leads/${l.id}/contact`, { method: "POST", body: { note: "Called" } }),
        ctx(l.id),
      ),
    );
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("CONTACTED");
    expect(r.body.firstContactAt).not.toBeNull();
    expect(r.body.activities.some((a: any) => a.type === "CONTACTED")).toBe(true);
  });

  it("PATCH status writes STATUS_CHANGED; reassign must target an active consultant", async () => {
    const l = await leadByPhone("9800000034");
    signInAs("asha");
    const s = await json(
      await lead.PATCH(
        req(`/leads/${l.id}`, { method: "PATCH", body: { status: "NEGOTIATION" } }),
        ctx(l.id),
      ),
    );
    expect(s.status).toBe(200);
    expect(s.body.activities.some((a: any) => a.type === "STATUS_CHANGED")).toBe(true);

    const bad = await json(
      await lead.PATCH(
        req(`/leads/${l.id}`, { method: "PATCH", body: { assignedToId: users.buyer1 } }),
        ctx(l.id),
      ),
    );
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.assignedToId).toBeTruthy();

    const empty = await json(
      await lead.PATCH(req(`/leads/${l.id}`, { method: "PATCH", body: {} }), ctx(l.id)),
    );
    expect(empty.status).toBe(400);

    const re = await json(
      await lead.PATCH(
        req(`/leads/${l.id}`, {
          method: "PATCH",
          body: { assignedToId: users.ravi, note: "Ravi knows CVTs" },
        }),
        ctx(l.id),
      ),
    );
    expect(re.status).toBe(200);
    expect(re.body.assignedTo.id).toBe(users.ravi);
    expect(re.body.activities.some((a: any) => a.type === "REASSIGNED")).toBe(true);
    // Asha no longer owns it.
    expect((await lead.GET(req(`/leads/${l.id}`), ctx(l.id))).status).toBe(403);
  });

  it("consultant options list active consultants with open-lead counts", async () => {
    signInAs("asha");
    const r = await json(await consultants.GET(req("/consultants"), undefined));
    expect(r.status).toBe(200);
    expect(r.body.find((c: any) => c.id === users.ravi)).toMatchObject({ name: "Ravi Srivastava" });
  });
});

describe("messaging & opt-out", () => {
  it("send to an opted-out lead → 409 OPTED_OUT and nothing logged", async () => {
    const l = await leadByPhone("9800000044");
    const before = await db.messageLog.count({ where: { leadId: l.id } });
    signInAs("asha");
    const r = await json(
      await send.POST(
        req(`/leads/${l.id}/send`, { method: "POST", body: { text: "Hello, following up." } }),
        ctx(l.id),
      ),
    );
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("OPTED_OUT");
    expect(await db.messageLog.count({ where: { leadId: l.id } })).toBe(before);
  });

  it("send logs a mock message, sets firstContactAt and records the edited AI draft", async () => {
    const l = await leadByPhone("9800000032");
    const draft = await db.aiOutput.create({
      data: {
        leadId: l.id,
        kind: "DRAFT",
        input: {},
        output: { text: "x" },
        model: "test",
        status: "OK",
      },
    });
    signInAs("asha");
    const text = "Namaste Sunita ji, I will call you at 4 pm today about the Model S CNG.";
    const r = await json(
      await send.POST(
        req(`/leads/${l.id}/send`, { method: "POST", body: { text, aiOutputId: draft.id } }),
        ctx(l.id),
      ),
    );
    expect(r.status).toBe(201);
    expect(r.body.messageId).toBeTruthy();
    const after = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(after.firstContactAt).not.toBeNull();
    const ai = await db.aiOutput.findUniqueOrThrow({ where: { id: draft.id } });
    expect(ai.editedText).toBe(text);
    expect(ai.sentAt).not.toBeNull();
  });

  it("sending an AI draft that quotes a discount is refused", async () => {
    const l = await leadByPhone("9800000031");
    const draft = await db.aiOutput.create({
      data: {
        leadId: l.id,
        kind: "DRAFT",
        input: {},
        output: { text: "x" },
        model: "test",
        status: "OK",
      },
    });
    signInAs("asha");
    const r = await json(
      await send.POST(
        req(`/leads/${l.id}/send`, {
          method: "POST",
          body: { text: "Get a flat discount of 20000 today!", aiOutputId: draft.id },
        }),
        ctx(l.id),
      ),
    );
    expect(r.status).toBe(400);
  });

  it("opt-out always returns ok, flags leads, and then blocks sends", async () => {
    const unknown = await json(
      await optout.POST(
        req("/optout", { method: "POST", body: { phone: "9800000999" } }),
        undefined,
      ),
    );
    expect(unknown).toEqual({ status: 200, body: { ok: true } });

    const l = await leadByPhone("9800000045");
    const r = await json(
      await optout.POST(
        req("/optout", { method: "POST", body: { phone: "+91 98000 00045" } }),
        undefined,
      ),
    );
    expect(r.body).toEqual({ ok: true });
    const after = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(after.optedOut).toBe(true);
    signInAs("vikram");
    const s = await json(
      await send.POST(
        req(`/leads/${l.id}/send`, { method: "POST", body: { text: "Hello, following up." } }),
        ctx(l.id),
      ),
    );
    expect(s.body.error.code).toBe("OPTED_OUT");
  });

  it("opt-out rejects an invalid phone", async () => {
    const r = await json(
      await optout.POST(req("/optout", { method: "POST", body: { phone: "12345" } }), undefined),
    );
    expect(r.status).toBe(400);
    expect(r.body.error.fields.phone).toBeTruthy();
  });
});

describe("public test-drive booking", () => {
  async function demoCar() {
    const sr = await db.showroom.findUniqueOrThrow({ where: { slug: "gomti-nagar" } });
    const v = await db.variant.findUniqueOrThrow({ where: { code: "NEW-H-02" } });
    const car = await db.demoCar.findFirstOrThrow({
      where: { showroomId: sr.id, variantId: v.id },
    });
    return { sr, car };
  }
  const buyer = { name: "Test Buyer", phone: "9800000501", locale: "en" };

  it("400 CONSENT_REQUIRED when consent is missing or false (checked before other validation)", async () => {
    for (const consent of [undefined, false, "true"]) {
      const r = await json(
        await testDrives.POST(
          req("/test-drives", { method: "POST", body: { consent } }),
          undefined,
        ),
      );
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe("CONSENT_REQUIRED");
    }
  });

  it("400 VALIDATION with field errors for bad input", async () => {
    const { sr, car } = await demoCar();
    const r = await json(
      await testDrives.POST(
        req("/test-drives", {
          method: "POST",
          body: {
            showroomId: sr.id,
            demoCarId: car.id,
            slotStart: "tomorrow",
            name: "A",
            phone: "123",
            consent: true,
          },
        }),
        undefined,
      ),
    );
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION");
    expect(Object.keys(r.body.error.fields)).toEqual(
      expect.arrayContaining(["slotStart", "name", "phone"]),
    );
  });

  it("400 SLOT_INVALID for a misaligned slot; 400 when the car is at another showroom", async () => {
    const { sr, car } = await demoCar();
    const misaligned = new Date(istSlot(4, 1).getTime() + 10 * 60_000).toISOString();
    const r = await json(
      await testDrives.POST(
        req("/test-drives", {
          method: "POST",
          body: {
            ...buyer,
            showroomId: sr.id,
            demoCarId: car.id,
            slotStart: misaligned,
            consent: true,
          },
        }),
        undefined,
      ),
    );
    expect(r.body.error.code).toBe("SLOT_INVALID");

    const other = await db.showroom.findUniqueOrThrow({ where: { slug: "kanpur-mall-road" } });
    const r2 = await json(
      await testDrives.POST(
        req("/test-drives", {
          method: "POST",
          body: {
            ...buyer,
            showroomId: other.id,
            demoCarId: car.id,
            slotStart: istSlot(4, 1).toISOString(),
            consent: true,
          },
        }),
        undefined,
      ),
    );
    expect(r2.status).toBe(400);
    expect(r2.body.error.fields.demoCarId).toBeTruthy();
  });

  it("books, assigns, acknowledges — and a second booking of the same slot gets 409 SLOT_TAKEN", async () => {
    const { sr, car } = await demoCar();
    const slotStart = istSlot(5, 3).toISOString();
    const body = { ...buyer, showroomId: sr.id, demoCarId: car.id, slotStart, consent: true };

    const r = await json(
      await testDrives.POST(req("/test-drives", { method: "POST", body }), undefined),
    );
    expect(r.status).toBe(201);
    expect(r.body.reference).toMatch(/^TD-/);
    expect(r.body.consultantName).toBeTruthy();
    expect(r.body.acknowledgement.body).toContain(r.body.reference);
    expect(r.body.acknowledgement.body).toContain("STOP");

    const l = await db.lead.findFirstOrThrow({
      where: { bookings: { some: { reference: r.body.reference } } },
    });
    expect(l).toMatchObject({ source: "TEST_DRIVE", status: "TEST_DRIVE_BOOKED", consent: true });
    expect(l.consentAt).not.toBeNull();
    expect(l.assignedToId).toBeTruthy();
    expect(await db.messageLog.count({ where: { leadId: l.id, template: "test_drive_ack" } })).toBe(
      1,
    );

    // The slot no longer shows as free.
    const date = new Date(new Date(slotStart).getTime() + 330 * 60_000).toISOString().slice(0, 10);
    const sl = await json(
      await slots.GET(
        req(`/slots?showroomId=${sr.id}&demoCarId=${car.id}&date=${date}`),
        undefined,
      ),
    );
    expect(sl.body.find((s: any) => s.start === slotStart)?.available).toBe(false);

    const leadsBefore = await db.lead.count();
    const dup = await json(
      await testDrives.POST(
        req("/test-drives", { method: "POST", body: { ...body, phone: "9800000502" } }),
        undefined,
      ),
    );
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("SLOT_TAKEN");
    // The whole transaction rolled back: no orphan lead.
    expect(await db.lead.count()).toBe(leadsBefore);
  });

  it("a fresh consented booking lifts an earlier opt-out for that phone", async () => {
    const { sr, car } = await demoCar();
    await db.optOut.upsert({
      where: { phone: "9800000503" },
      update: {},
      create: { phone: "9800000503" },
    });
    const r = await json(
      await testDrives.POST(
        req("/test-drives", {
          method: "POST",
          body: {
            ...buyer,
            phone: "9800000503",
            showroomId: sr.id,
            demoCarId: car.id,
            slotStart: istSlot(6, 2).toISOString(),
            consent: true,
          },
        }),
        undefined,
      ),
    );
    expect(r.status).toBe(201);
    expect(await db.optOut.findUnique({ where: { phone: "9800000503" } })).toBeNull();
  });
});

describe("public enquiry, prices & privacy", () => {
  it("enquiry: CONSENT_REQUIRED, then 201 with assignment", async () => {
    const no = await json(
      await leads.POST(
        req("/leads", { method: "POST", body: { name: "Asha", phone: "9800000601" } }),
        undefined,
      ),
    );
    expect(no.body.error.code).toBe("CONSENT_REQUIRED");

    const v = await db.variant.findUniqueOrThrow({ where: { code: "NEW-H-02" } });
    const r = await json(
      await leads.POST(
        req("/leads", {
          method: "POST",
          body: {
            name: "Enquiry Buyer",
            phone: "9800000601",
            interestVariantId: v.id,
            consent: true,
            locale: "hi",
          },
        }),
        undefined,
      ),
    );
    expect(r.status).toBe(201);
    expect(r.body.reference).toMatch(/^EN-/);
    const l = await db.lead.findUniqueOrThrow({ where: { id: r.body.leadId } });
    expect(l).toMatchObject({ source: "WEB", interestModelId: v.modelId, locale: "hi" });
    expect(l.assignedToId).toBeTruthy();
  });

  it("enquiry with an unknown variant id → 400", async () => {
    const r = await json(
      await leads.POST(
        req("/leads", {
          method: "POST",
          body: { name: "X Buyer", phone: "9800000602", interestVariantId: "nope", consent: true },
        }),
        undefined,
      ),
    );
    expect(r.status).toBe(400);
    expect(r.body.error.fields.interestVariantId).toBeTruthy();
  });

  it("price: NEW-H-02 Lucknow breakup from the admin table; missing row → 404 PRICE_NOT_PUBLISHED", async () => {
    const v = await db.variant.findUniqueOrThrow({ where: { code: "NEW-H-02" } });
    const r = await json(
      await price.GET(req(`/price?variantId=${v.id}&citySlug=lucknow`), undefined),
    );
    expect(r.status).toBe(200);
    expect(r.body.lines[0]).toMatchObject({ key: "exShowroom", amount: 1_245_000 });
    expect(r.body.total).toBe(r.body.lines.reduce((s: number, l: any) => s + l.amount, 0));

    const t = await db.variant.findUniqueOrThrow({ where: { code: "NEW-T-02" } });
    const nf = await json(
      await price.GET(req(`/price?variantId=${t.id}&citySlug=varanasi`), undefined),
    );
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe("PRICE_NOT_PUBLISHED");

    const bad = await json(await price.GET(req(`/price?variantId=${v.id}`), undefined));
    expect(bad.status).toBe(400);
  });

  it("full registration is never sent to the used-car manager; admin gets it", async () => {
    signInAs("ucm");
    const m = await adminUsedCars.GET(req("/admin/used-cars"), undefined);
    const text = await m.clone().text();
    expect(text).not.toContain("UP32 AB 1182");
    expect(text).not.toContain('"registration"');
    const cars = (await m.json()) as any[];
    expect(cars.find((c) => c.stockId === "UC-1182").registrationMasked).toBe("UP32 •• ••82");

    signInAs("admin");
    const a = await json(await adminUsedCars.GET(req("/admin/used-cars"), undefined));
    expect(a.body.find((c: any) => c.stockId === "UC-1182").registration).toBe("UP32 AB 1182");
  });

  it("lead payloads for a used-car enquiry carry no registration number", async () => {
    const l = await leadByPhone("9800000043");
    signInAs("admin");
    const text = await (await lead.GET(req(`/leads/${l.id}`), ctx(l.id))).text();
    expect(text).not.toMatch(/UP\d{2} [A-Z]{2} \d{4}/);
  });
});

describe("admin rules", () => {
  it("admin cannot demote or deactivate themselves", async () => {
    signInAs("admin");
    const r = await json(
      await adminUser.PATCH(
        req(`/admin/users/${users.admin}`, { method: "PATCH", body: { role: "CONSULTANT" } }),
        ctx(users.admin),
      ),
    );
    expect(r.status).toBe(409);
    expect(
      (
        await adminUser.DELETE(
          req(`/admin/users/${users.admin}`, { method: "DELETE" }),
          ctx(users.admin),
        )
      ).status,
    ).toBe(409);
  });

  it("user create hashes the password and never returns it", async () => {
    signInAs("admin");
    const r = await json(
      await adminUsers.POST(
        req("/admin/users", {
          method: "POST",
          body: {
            name: "New Consultant",
            email: `new${Date.now()}@brandx.test`,
            role: "CONSULTANT",
            password: "Secret@123",
          },
        }),
        undefined,
      ),
    );
    expect(r.status).toBe(201);
    expect(r.body).not.toHaveProperty("passwordHash");
    const noPw = await json(
      await adminUsers.POST(
        req("/admin/users", {
          method: "POST",
          body: { name: "No Pw", email: "nopw@brandx.test", role: "BUYER" },
        }),
        undefined,
      ),
    );
    expect(noPw.status).toBe(400);
  });

  it("deleting a model with leads → 409 CONFLICT", async () => {
    const m = await db.model.findUniqueOrThrow({ where: { slug: "model-h" } });
    signInAs("admin");
    const r = await json(
      await adminModel.DELETE(req(`/admin/models/${m.id}`, { method: "DELETE" }), ctx(m.id)),
    );
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("CONFLICT");
  });

  it("price upsert records who saved it; invalid payload → 400", async () => {
    const v = await db.variant.findUniqueOrThrow({ where: { code: "NEW-T-02" } });
    const c = await db.city.findUniqueOrThrow({ where: { slug: "varanasi" } });
    signInAs("admin");
    const bad = await json(
      await adminPrices.POST(
        req("/admin/prices", {
          method: "POST",
          body: { variantId: v.id, cityId: c.id, roadTaxPct: 99 },
        }),
        undefined,
      ),
    );
    expect(bad.status).toBe(400);
    const body = {
      variantId: v.id,
      cityId: c.id,
      roadTaxPct: 10,
      registrationFee: 2100,
      insurance: 32608,
      accessoriesPack: 15000,
      validUntil: "2099-01-31",
    };
    const r = await json(
      await adminPrices.POST(req("/admin/prices", { method: "POST", body }), undefined),
    );
    expect(r.status).toBe(200);
    expect(r.body.updatedById).toBe(users.admin);
    expect(r.body.roadTaxPct).toBe(10);
    // Restore the "not yet published" demo row.
    await db.priceComponent.delete({ where: { id: r.body.id } });
  });
});

describe("rate limiting", () => {
  it("public POSTs return 429 RATE_LIMITED after 10 per minute from one IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await optout.POST(
        req("/optout", { method: "POST", body: { phone: "9800000998" }, ip: "203.0.113.9" }),
        undefined,
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
    const other = await optout.POST(
      req("/optout", { method: "POST", body: { phone: "9800000998" }, ip: "203.0.113.10" }),
      undefined,
    );
    expect(other.status).toBe(200);
  });
});

describe("missed-SLA escalation", () => {
  const cron = (auth?: string) =>
    cronEscalate.GET(
      new Request(`${BASE}/cron/escalate`, { headers: auth ? { authorization: auth } : {} }),
      undefined,
    );

  it("rejects calls without the cron secret", async () => {
    expect((await cron()).status).toBe(401);
    expect((await cron("Bearer wrong")).status).toBe(401);
  });

  it("reassigns an uncontacted lead after 5 min to someone else, then alerts the desk at 10 min, once each", async () => {
    signInAs(null);
    const created = await json(
      await leads.POST(
        req("/leads", {
          method: "POST",
          body: { name: "Escalation Case", phone: "9800000777", consent: true, message: "Need a call" },
        }),
        undefined,
      ),
    );
    expect(created.status).toBe(201);
    const before = await leadByPhone("9800000777");
    expect(before.assignedToId).not.toBeNull();

    // Still inside the window: nothing happens.
    await cron("Bearer test-cron-secret");
    expect((await leadByPhone("9800000777")).escalationLevel).toBe(0);

    await db.lead.update({ where: { id: before.id }, data: { createdAt: new Date(Date.now() - 6 * 60_000) } });
    expect((await cron("Bearer test-cron-secret")).status).toBe(200);
    const after = await leadByPhone("9800000777");
    expect(after.escalationLevel).toBe(1);
    expect(after.assignedToId).not.toBe(before.assignedToId);
    const note = await db.leadActivity.findFirstOrThrow({
      where: { leadId: before.id, type: "REASSIGNED" },
    });
    expect(note.note).toMatch(/Not contacted within 5 minutes/);

    // A second sweep inside the same window does nothing more.
    await cron("Bearer test-cron-secret");
    expect((await leadByPhone("9800000777")).assignedToId).toBe(after.assignedToId);

    await db.lead.update({ where: { id: before.id }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });
    await cron("Bearer test-cron-secret");
    const final = await leadByPhone("9800000777");
    expect(final.escalationLevel).toBe(2);
    expect(final.assignedToId).toBe(after.assignedToId);
  });

  it("never escalates a lead once it has been contacted", async () => {
    const l = await leadByPhone("9800000777");
    await db.lead.update({
      where: { id: l.id },
      data: { escalationLevel: 0, firstContactAt: new Date(), createdAt: new Date(Date.now() - 30 * 60_000) },
    });
    await cron("Bearer test-cron-secret");
    expect((await leadByPhone("9800000777")).escalationLevel).toBe(0);
  });
});
