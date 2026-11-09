/**
 * Brand X Dealer Platform — sample data.
 *
 * Idempotent:
 *  - Catalogue / reference data (cities, showrooms, workshops, models, variants, prices,
 *    used cars, users, demo cars) is UPSERTED on its unique key, so re-running never duplicates.
 *  - Transactional demo data (leads, activities, bookings, AI outputs, message logs, opt-outs,
 *    past sales) is DELETED and re-created every run, because its timestamps are relative to "now"
 *    (the SLA timers must show green/amber/red on a fresh seed). This wipes any leads created
 *    while clicking around in dev — intended for a dev/demo database only.
 *
 * Data from the brief (exact): NEW-H-02, UC-1182, UC-1190.
 * Everything else is labelled ASSUMPTION (invented, obviously fake sample data).
 */
import {
  PrismaClient,
  Prisma,
  type Fuel,
  type Transmission,
  type LeadSource,
  type LeadStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);

// ─── Pricing rules (mirror docs/ASSUMPTIONS.md) ─────────────────────────────
// ASSUMPTION: UP road tax 8% below ₹10,00,000 ex-showroom, 10% at or above.
const roadTaxPctFor = (ex: number) => (ex >= 1_000_000 ? 10 : 8);
// ASSUMPTION: Registration ₹600 RTO + ₹1,500 handling.
const REGISTRATION_FEE = 2_100;
// ASSUMPTION: First-year insurance ≈ 3.2% of ex-showroom.
const insuranceFor = (ex: number) => Math.round(ex * 0.032);
// ASSUMPTION: Accessories pack ₹15,000.
const ACCESSORIES = 15_000;
// ASSUMPTION: Prices valid 30 days from save.
const validUntil = new Date(now.getTime() + 30 * DAY);

// ─── Reference data ─────────────────────────────────────────────────────────
// ASSUMPTION: cities served.
const CITIES = [
  { slug: "lucknow", name: "Lucknow", nameHi: "लखनऊ" },
  { slug: "kanpur", name: "Kanpur", nameHi: "कानपुर" },
  { slug: "varanasi", name: "Varanasi", nameHi: "वाराणसी" },
];

// ASSUMPTION: showroom names, addresses and phones are invented.
const SHOWROOMS = [
  {
    slug: "gomti-nagar",
    name: "Brand X Gomti Nagar",
    address: "Plot 12, Vibhuti Khand, Gomti Nagar, Lucknow 226010",
    city: "lucknow",
    phone: "9800000101",
  },
  {
    slug: "hazratganj",
    name: "Brand X Hazratganj",
    address: "45 Ashok Marg, Hazratganj, Lucknow 226001",
    city: "lucknow",
    phone: "9800000102",
  },
  {
    slug: "kanpur-mall-road",
    name: "Brand X Kanpur Mall Road",
    address: "88 Mall Road, Kanpur 208001",
    city: "kanpur",
    phone: "9800000103",
  },
];

// ASSUMPTION: two workshops, 4–6 bays.
const WORKSHOPS = [
  {
    slug: "gomti-nagar-service",
    name: "Brand X Service — Gomti Nagar",
    showroom: "gomti-nagar",
    bays: 6,
  },
  {
    slug: "kanpur-service",
    name: "Brand X Service — Kanpur",
    showroom: "kanpur-mall-road",
    bays: 4,
  },
];

type VariantSeed = {
  slug: string;
  name: string;
  code: string;
  fuel: Fuel;
  transmission: Transmission;
  ex: number;
  specs: Record<string, string | number>;
};
type ModelSeed = {
  slug: string;
  name: string;
  bodyType: string;
  description: string;
  descriptionHi: string;
  sortOrder: number;
  gallery: string[];
  colours: { name: string; nameHi: string; hex: string }[];
  variants: VariantSeed[];
};

// ASSUMPTION: all models/variants/specs/colours except NEW-H-02 are invented sample data.
const MODELS: ModelSeed[] = [
  {
    slug: "model-h",
    name: "Model H",
    bodyType: "SUV",
    description:
      "A roomy five-seat SUV with high ground clearance, built for city traffic and highway trips alike.",
    descriptionHi:
      "ऊँचे ग्राउंड क्लीयरेंस वाली एक बड़ी पाँच सीटों वाली SUV — शहर और हाईवे दोनों के लिए।",
    sortOrder: 1,
    gallery: ["/cars/model-h.svg", "/cars/model-h-side.svg", "/cars/model-h-rear.svg"],
    colours: [
      { name: "Pearl White", nameHi: "पर्ल व्हाइट", hex: "#F4F4F2" },
      { name: "Lunar Silver", nameHi: "लूनर सिल्वर", hex: "#A7ABB0" },
      { name: "Obsidian Blue", nameHi: "ऑब्सिडियन ब्लू", hex: "#1F2A44" },
      { name: "Radiant Red", nameHi: "रेडियंट रेड", hex: "#A3161B" },
    ],
    variants: [
      {
        slug: "lx-manual-petrol",
        name: "LX Manual Petrol",
        code: "NEW-H-01",
        fuel: "PETROL",
        transmission: "MANUAL",
        ex: 1_049_000,
        specs: {
          engine: "1498 cc",
          power: "119 bhp",
          torque: "145 Nm",
          mileage: "16.8 km/l",
          seats: 5,
          bootLitres: 458,
        },
      },
      // From the brief (exact): NEW-H-02 Model H ZX Automatic Petrol, ex-showroom ₹12,45,000.
      {
        slug: "zx-automatic-petrol",
        name: "ZX Automatic Petrol",
        code: "NEW-H-02",
        fuel: "PETROL",
        transmission: "AUTOMATIC",
        ex: 1_245_000,
        // ASSUMPTION: specs invented.
        specs: {
          engine: "1498 cc",
          power: "119 bhp",
          torque: "145 Nm",
          mileage: "16.1 km/l",
          seats: 5,
          bootLitres: 458,
        },
      },
      {
        slug: "zx-manual-diesel",
        name: "ZX Manual Diesel",
        code: "NEW-H-03",
        fuel: "DIESEL",
        transmission: "MANUAL",
        ex: 1_389_000,
        specs: {
          engine: "1493 cc",
          power: "114 bhp",
          torque: "250 Nm",
          mileage: "20.5 km/l",
          seats: 5,
          bootLitres: 458,
        },
      },
    ],
  },
  {
    slug: "model-c",
    name: "Model C",
    bodyType: "Sedan",
    description: "A comfortable family sedan with a big boot and a quiet cabin.",
    descriptionHi: "बड़े बूट और शांत केबिन वाली आरामदायक फ़ैमिली सेडान।",
    sortOrder: 2,
    gallery: ["/cars/model-c.svg", "/cars/model-c-side.svg", "/cars/model-c-rear.svg"],
    colours: [
      { name: "Pearl White", nameHi: "पर्ल व्हाइट", hex: "#F4F4F2" },
      { name: "Graphite Grey", nameHi: "ग्रेफ़ाइट ग्रे", hex: "#4A4E54" },
      { name: "Royal Maroon", nameHi: "रॉयल मैरून", hex: "#5C1A24" },
    ],
    variants: [
      {
        slug: "sx-manual-petrol",
        name: "SX Manual Petrol",
        code: "NEW-C-01",
        fuel: "PETROL",
        transmission: "MANUAL",
        ex: 945_000,
        specs: {
          engine: "1498 cc",
          power: "119 bhp",
          torque: "145 Nm",
          mileage: "17.8 km/l",
          seats: 5,
          bootLitres: 506,
        },
      },
      {
        slug: "vx-cvt-petrol",
        name: "VX CVT Petrol",
        code: "NEW-C-02",
        fuel: "PETROL",
        transmission: "AUTOMATIC",
        ex: 1_069_000,
        specs: {
          engine: "1498 cc",
          power: "119 bhp",
          torque: "145 Nm",
          mileage: "18.4 km/l",
          seats: 5,
          bootLitres: 506,
        },
      },
      {
        slug: "vx-manual-diesel",
        name: "VX Manual Diesel",
        code: "NEW-C-03",
        fuel: "DIESEL",
        transmission: "MANUAL",
        ex: 1_125_000,
        specs: {
          engine: "1498 cc",
          power: "99 bhp",
          torque: "200 Nm",
          mileage: "24.1 km/l",
          seats: 5,
          bootLitres: 506,
        },
      },
    ],
  },
  {
    slug: "model-s",
    name: "Model S",
    bodyType: "Hatchback",
    description: "A nimble hatchback that is easy to park and light on fuel.",
    descriptionHi: "पार्क करने में आसान और कम ईंधन खर्च वाली फुर्तीली हैचबैक।",
    sortOrder: 3,
    gallery: ["/cars/model-s.svg", "/cars/model-s-side.svg", "/cars/model-s-rear.svg"],
    colours: [
      { name: "Arctic White", nameHi: "आर्कटिक व्हाइट", hex: "#FAFAFA" },
      { name: "Fire Orange", nameHi: "फ़ायर ऑरेंज", hex: "#D9541E" },
      { name: "Midnight Black", nameHi: "मिडनाइट ब्लैक", hex: "#111214" },
    ],
    variants: [
      {
        slug: "lx-manual-petrol",
        name: "LX Manual Petrol",
        code: "NEW-S-01",
        fuel: "PETROL",
        transmission: "MANUAL",
        ex: 589_000,
        specs: {
          engine: "1197 cc",
          power: "82 bhp",
          torque: "113 Nm",
          mileage: "22.4 km/l",
          seats: 5,
          bootLitres: 268,
        },
      },
      {
        slug: "lx-manual-cng",
        name: "LX Manual CNG",
        code: "NEW-S-02",
        fuel: "CNG",
        transmission: "MANUAL",
        ex: 669_000,
        specs: {
          engine: "1197 cc",
          power: "69 bhp",
          torque: "95 Nm",
          mileage: "30.9 km/kg",
          seats: 5,
          bootLitres: 210,
        },
      },
      {
        slug: "vx-amt-petrol",
        name: "VX AMT Petrol",
        code: "NEW-S-03",
        fuel: "PETROL",
        transmission: "AUTOMATIC",
        ex: 689_000,
        specs: {
          engine: "1197 cc",
          power: "82 bhp",
          torque: "113 Nm",
          mileage: "22.9 km/l",
          seats: 5,
          bootLitres: 268,
        },
      },
    ],
  },
  {
    slug: "model-t",
    name: "Model T",
    bodyType: "Compact SUV",
    description: "A compact SUV under four metres with a turbo-petrol option.",
    descriptionHi: "चार मीटर से छोटी कॉम्पैक्ट SUV, टर्बो-पेट्रोल विकल्प के साथ।",
    sortOrder: 4,
    gallery: ["/cars/model-t.svg", "/cars/model-t-side.svg", "/cars/model-t-rear.svg"],
    colours: [
      { name: "Pearl White", nameHi: "पर्ल व्हाइट", hex: "#F4F4F2" },
      { name: "Forest Green", nameHi: "फ़ॉरेस्ट ग्रीन", hex: "#2E4A3A" },
      { name: "Lunar Silver", nameHi: "लूनर सिल्वर", hex: "#A7ABB0" },
    ],
    variants: [
      {
        slug: "ex-manual-petrol",
        name: "EX Manual Petrol",
        code: "NEW-T-01",
        fuel: "PETROL",
        transmission: "MANUAL",
        ex: 799_000,
        specs: {
          engine: "1197 cc",
          power: "82 bhp",
          torque: "115 Nm",
          mileage: "19.2 km/l",
          seats: 5,
          bootLitres: 350,
        },
      },
      {
        slug: "sx-turbo-automatic-petrol",
        name: "SX Turbo Automatic Petrol",
        code: "NEW-T-02",
        fuel: "PETROL",
        transmission: "AUTOMATIC",
        ex: 1_019_000,
        specs: {
          engine: "998 cc turbo",
          power: "118 bhp",
          torque: "172 Nm",
          mileage: "18.1 km/l",
          seats: 5,
          bootLitres: 350,
        },
      },
    ],
  },
];

// Demo of "Price not yet published": this variant has no Varanasi price row.
const UNPUBLISHED = { model: "model-t", variant: "sx-turbo-automatic-petrol", city: "varanasi" };

const DEMO_PASSWORD = "Demo@1234";

// ASSUMPTION: staff names and phones are invented (fake 98000000xx numbers).
const USERS: {
  email: string;
  name: string;
  role: "ADMIN" | "USED_CAR_MANAGER" | "CONSULTANT" | "BUYER";
  showroom?: string;
  phone?: string;
}[] = [
  { email: "admin@brandx.test", name: "Admin (Lead Desk)", role: "ADMIN", phone: "9800000001" },
  {
    email: "ucm@brandx.test",
    name: "Uday Mehra",
    role: "USED_CAR_MANAGER",
    showroom: "gomti-nagar",
    phone: "9800000002",
  },
  {
    email: "asha.consultant@brandx.test",
    name: "Asha Verma",
    role: "CONSULTANT",
    showroom: "gomti-nagar",
    phone: "9800000011",
  },
  {
    email: "ravi.consultant@brandx.test",
    name: "Ravi Srivastava",
    role: "CONSULTANT",
    showroom: "gomti-nagar",
    phone: "9800000012",
  },
  {
    email: "neha.consultant@brandx.test",
    name: "Neha Kapoor",
    role: "CONSULTANT",
    showroom: "hazratganj",
    phone: "9800000013",
  },
  {
    email: "imran.consultant@brandx.test",
    name: "Imran Siddiqui",
    role: "CONSULTANT",
    showroom: "hazratganj",
    phone: "9800000014",
  },
  {
    email: "pooja.consultant@brandx.test",
    name: "Pooja Tiwari",
    role: "CONSULTANT",
    showroom: "kanpur-mall-road",
    phone: "9800000015",
  },
  {
    email: "vikram.consultant@brandx.test",
    name: "Vikram Yadav",
    role: "CONSULTANT",
    showroom: "kanpur-mall-road",
    phone: "9800000016",
  },
  { email: "buyer1@brandx.test", name: "Demo Buyer One", role: "BUYER", phone: "9800000021" },
  { email: "buyer2@brandx.test", name: "Demo Buyer Two", role: "BUYER", phone: "9800000022" },
];

const INSPECTION_STD = [
  { item: "Engine", result: "OK" },
  { item: "Gearbox", result: "OK" },
  { item: "Brakes", result: "OK" },
  { item: "Suspension", result: "OK" },
  { item: "Tyres", result: "OK" },
  { item: "Battery", result: "OK" },
  { item: "AC & electricals", result: "OK" },
  { item: "Body & paint", result: "OK" },
] as const;
type Insp = { item: string; result: "OK" | "ATTENTION" | "REPLACED"; note?: string };
const inspection = (overrides: Insp[] = []): Insp[] =>
  INSPECTION_STD.map((i) => overrides.find((o) => o.item === i.item) ?? { ...i });

const USED_CARS = [
  // From the brief (exact): UC-1182 Model C VX Diesel 2022, 41,200 km, ₹8,45,000, AVAILABLE.
  {
    stockId: "UC-1182",
    slug: "uc-1182-model-c-vx-diesel-2022",
    modelName: "Model C",
    variantName: "VX Diesel",
    fuel: "DIESEL" as Fuel,
    transmission: "MANUAL" as Transmission,
    year: 2022,
    km: 41_200,
    price: 845_000,
    status: "AVAILABLE" as const,
    // ASSUMPTION: owners, registration, colour, inspection invented.
    owners: 1,
    registration: "UP32 AB 1182",
    colour: "Graphite Grey",
    modelSlug: "model-c",
    inspection: inspection([
      { item: "Tyres", result: "ATTENTION", note: "Front tyres ~40% tread left" },
    ]),
  },
  // From the brief (exact): UC-1190 Model S LX Petrol 2021, 58,600 km, ₹5,12,000, BOOKED.
  {
    stockId: "UC-1190",
    slug: "uc-1190-model-s-lx-petrol-2021",
    modelName: "Model S",
    variantName: "LX Petrol",
    fuel: "PETROL" as Fuel,
    transmission: "MANUAL" as Transmission,
    year: 2021,
    km: 58_600,
    price: 512_000,
    status: "BOOKED" as const,
    owners: 2,
    registration: "UP32 CK 1190",
    colour: "Fire Orange",
    modelSlug: "model-s",
    inspection: inspection([
      { item: "Battery", result: "REPLACED", note: "New battery fitted during refurbishment" },
    ]),
  },
  // ASSUMPTION: the four rows below are invented sample stock.
  {
    stockId: "UC-1175",
    slug: "uc-1175-model-h-zx-petrol-2020",
    modelName: "Model H",
    variantName: "ZX Petrol",
    fuel: "PETROL" as Fuel,
    transmission: "AUTOMATIC" as Transmission,
    year: 2020,
    km: 63_400,
    price: 935_000,
    status: "AVAILABLE" as const,
    owners: 2,
    registration: "UP32 HN 1175",
    colour: "Pearl White",
    modelSlug: "model-h",
    inspection: inspection([
      { item: "Body & paint", result: "ATTENTION", note: "Minor scratch on rear bumper" },
    ]),
  },
  {
    stockId: "UC-1201",
    slug: "uc-1201-model-t-ex-petrol-2023",
    modelName: "Model T",
    variantName: "EX Petrol",
    fuel: "PETROL" as Fuel,
    transmission: "MANUAL" as Transmission,
    year: 2023,
    km: 18_900,
    price: 715_000,
    status: "AVAILABLE" as const,
    owners: 1,
    registration: "UP78 FT 1201",
    colour: "Forest Green",
    modelSlug: "model-t",
    inspection: inspection(),
  },
  {
    stockId: "UC-1168",
    slug: "uc-1168-model-c-sx-petrol-2019",
    modelName: "Model C",
    variantName: "SX Petrol",
    fuel: "PETROL" as Fuel,
    transmission: "MANUAL" as Transmission,
    year: 2019,
    km: 82_300,
    price: 565_000,
    status: "SOLD" as const,
    owners: 3,
    registration: "UP32 DL 1168",
    colour: "Royal Maroon",
    modelSlug: "model-c",
    inspection: inspection([
      { item: "Suspension", result: "REPLACED", note: "Front shock absorbers replaced" },
      { item: "Tyres", result: "REPLACED", note: "All four tyres new" },
    ]),
  },
  {
    stockId: "UC-1205",
    slug: "uc-1205-model-s-vx-amt-2022",
    modelName: "Model S",
    variantName: "VX AMT",
    fuel: "PETROL" as Fuel,
    transmission: "AUTOMATIC" as Transmission,
    year: 2022,
    km: 27_500,
    price: 598_000,
    status: "AVAILABLE" as const,
    owners: 1,
    registration: "UP65 BS 1205",
    colour: "Arctic White",
    modelSlug: "model-s",
    inspection: inspection(),
  },
];

// ASSUMPTION: historical sales for the manager-only price band (invented).
const PAST_SALES: {
  modelName: string;
  year: number;
  km: number;
  price: number;
  daysAgo: number;
}[] = [
  { modelName: "Model C", year: 2022, km: 35_000, price: 872_000, daysAgo: 20 },
  { modelName: "Model C", year: 2022, km: 47_800, price: 829_000, daysAgo: 45 },
  { modelName: "Model C", year: 2021, km: 52_000, price: 781_000, daysAgo: 70 },
  { modelName: "Model C", year: 2023, km: 22_500, price: 935_000, daysAgo: 12 },
  { modelName: "Model C", year: 2021, km: 61_200, price: 752_000, daysAgo: 95 },
  { modelName: "Model C", year: 2020, km: 74_000, price: 668_000, daysAgo: 130 },
  { modelName: "Model S", year: 2021, km: 55_000, price: 498_000, daysAgo: 25 },
  { modelName: "Model S", year: 2021, km: 61_900, price: 486_000, daysAgo: 52 },
  { modelName: "Model S", year: 2020, km: 70_400, price: 441_000, daysAgo: 88 },
  { modelName: "Model S", year: 2022, km: 33_100, price: 559_000, daysAgo: 15 },
  { modelName: "Model S", year: 2022, km: 40_800, price: 541_000, daysAgo: 60 },
  { modelName: "Model S", year: 2019, km: 89_000, price: 389_000, daysAgo: 140 },
  { modelName: "Model S", year: 2022, km: 24_000, price: 572_000, daysAgo: 33 },
  // ASSUMPTION: extra fictional comparables so every seeded used car can show a price band.
  { modelName: "Model C", year: 2019, km: 88_500, price: 612_000, daysAgo: 40 },
  { modelName: "Model C", year: 2018, km: 95_000, price: 571_000, daysAgo: 110 },
  { modelName: "Model H", year: 2020, km: 58_000, price: 968_000, daysAgo: 18 },
  { modelName: "Model H", year: 2021, km: 49_500, price: 1_045_000, daysAgo: 64 },
  { modelName: "Model H", year: 2019, km: 72_300, price: 879_000, daysAgo: 99 },
  { modelName: "Model T", year: 2023, km: 15_200, price: 742_000, daysAgo: 22 },
  { modelName: "Model T", year: 2022, km: 26_800, price: 688_000, daysAgo: 57 },
  { modelName: "Model T", year: 2023, km: 31_000, price: 701_000, daysAgo: 81 },
];

/** IST slot start: `daysAhead` days from today (IST), slot index k on the 45-min grid from 10:00 IST. */
function istSlot(daysAhead: number, k: number): Date {
  const istNow = new Date(now.getTime() + 330 * MIN);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate() + daysAhead;
  // 10:00 IST = 04:30 UTC.
  return new Date(Date.UTC(y, m, d, 4, 30) + k * 45 * MIN);
}

async function main() {
  console.log("Seeding Brand X sample data…");

  // ── Cities ──
  const city: Record<string, string> = {};
  for (const c of CITIES) {
    const row = await db.city.upsert({
      where: { slug: c.slug },
      update: { name: c.name, nameHi: c.nameHi },
      create: c,
    });
    city[c.slug] = row.id;
  }

  // ── Showrooms (ASSUMPTION: 10:00–19:00 IST) ──
  const showroom: Record<string, { id: string; name: string }> = {};
  for (const s of SHOWROOMS) {
    const data = {
      name: s.name,
      address: s.address,
      cityId: city[s.city],
      phone: s.phone,
      openHour: 10,
      closeHour: 19,
    };
    const row = await db.showroom.upsert({
      where: { slug: s.slug },
      update: data,
      create: { slug: s.slug, ...data },
    });
    showroom[s.slug] = { id: row.id, name: row.name };
  }

  for (const w of WORKSHOPS) {
    const data = { name: w.name, showroomId: showroom[w.showroom].id, bays: w.bays };
    await db.workshop.upsert({
      where: { slug: w.slug },
      update: data,
      create: { slug: w.slug, ...data },
    });
  }

  // ── Users ──
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user: Record<string, { id: string; name: string }> = {};
  for (const u of USERS) {
    const data = {
      name: u.name,
      role: u.role,
      phone: u.phone ?? null,
      showroomId: u.showroom ? showroom[u.showroom].id : null,
      isActive: true,
      passwordHash,
    };
    const row = await db.user.upsert({
      where: { email: u.email },
      update: data,
      create: { email: u.email, ...data },
    });
    user[u.email.split("@")[0].split(".")[0]] = { id: row.id, name: row.name };
  }

  // ── Models, variants, prices, demo cars ──
  const model: Record<string, { id: string; name: string }> = {};
  const variant: Record<string, { id: string; name: string; modelId: string; label: string }> = {};
  for (const m of MODELS) {
    const mData = {
      name: m.name,
      bodyType: m.bodyType,
      description: m.description,
      descriptionHi: m.descriptionHi,
      heroImage: `/cars/${m.slug}.svg`,
      gallery: m.gallery,
      isActive: true,
      sortOrder: m.sortOrder,
    };
    const mRow = await db.model.upsert({
      where: { slug: m.slug },
      update: mData,
      create: { slug: m.slug, ...mData },
    });
    model[m.slug] = { id: mRow.id, name: mRow.name };

    for (const v of m.variants) {
      const vData = {
        name: v.name,
        code: v.code,
        fuel: v.fuel,
        transmission: v.transmission,
        exShowroomPrice: v.ex,
        specs: v.specs,
        colours: m.colours,
        isActive: true,
      };
      const vRow = await db.variant.upsert({
        where: { modelId_slug: { modelId: mRow.id, slug: v.slug } },
        update: vData,
        create: { modelId: mRow.id, slug: v.slug, ...vData },
      });
      const key = `${m.slug}/${v.slug}`;
      variant[key] = { id: vRow.id, name: v.name, modelId: mRow.id, label: `${m.name} ${v.name}` };

      for (const c of CITIES) {
        const skip =
          m.slug === UNPUBLISHED.model &&
          v.slug === UNPUBLISHED.variant &&
          c.slug === UNPUBLISHED.city;
        if (skip) {
          await db.priceComponent.deleteMany({
            where: { variantId: vRow.id, cityId: city[c.slug] },
          });
          continue;
        }
        const pData = {
          roadTaxPct: new Prisma.Decimal(roadTaxPctFor(v.ex)),
          registrationFee: REGISTRATION_FEE,
          insurance: insuranceFor(v.ex),
          accessoriesPack: ACCESSORIES,
          otherCharges: 0,
          validUntil,
          updatedById: user.admin.id,
        };
        await db.priceComponent.upsert({
          where: { variantId_cityId: { variantId: vRow.id, cityId: city[c.slug] } },
          update: pData,
          create: { variantId: vRow.id, cityId: city[c.slug], ...pData },
        });
      }

      // ASSUMPTION: one demo car per variant per showroom. No unique key in the schema → find-or-create.
      for (const s of SHOWROOMS) {
        const label = `${m.name} ${v.name} (demo)`;
        const existing = await db.demoCar.findFirst({
          where: { showroomId: showroom[s.slug].id, variantId: vRow.id },
        });
        if (existing)
          await db.demoCar.update({ where: { id: existing.id }, data: { label, isActive: true } });
        else
          await db.demoCar.create({
            data: { showroomId: showroom[s.slug].id, variantId: vRow.id, label },
          });
      }
    }
  }

  // ── Used cars ──
  const usedCar: Record<string, string> = {};
  for (const u of USED_CARS) {
    const { modelSlug, ...rest } = u;
    // Images point at the model silhouette (Agent D's SVGs); ASSUMPTION: illustrative only.
    const data = { ...rest, images: [`/cars/${modelSlug}.svg`, `/cars/${modelSlug}-side.svg`] };
    const row = await db.usedCar.upsert({
      where: { stockId: u.stockId },
      update: data,
      create: data,
    });
    usedCar[u.stockId] = row.id;
  }

  // ── Transactional demo data: wipe and recreate ──
  await db.messageLog.deleteMany({});
  await db.aiOutput.deleteMany({});
  await db.leadActivity.deleteMany({});
  await db.testDriveBooking.deleteMany({});
  await db.lead.deleteMany({});
  await db.optOut.deleteMany({});
  await db.pastSale.deleteMany({});

  await db.pastSale.createMany({
    data: PAST_SALES.map(({ daysAgo, ...p }) => ({ ...p, soldAt: ago(daysAgo * DAY) })),
  });

  // Reset round-robin tie-breakers so auto-assignment is predictable after a seed.
  await db.user.updateMany({ where: { role: "CONSULTANT" }, data: { lastAssignedAt: null } });

  type LeadSeed = {
    name: string;
    phone: string;
    email?: string;
    source: LeadSource;
    status: LeadStatus;
    locale?: "en" | "hi";
    variant?: string; // "model-h/zx-automatic-petrol"
    model?: string;
    used?: string;
    showroom: string;
    citySlug: string;
    assignee: string;
    createdMinAgo: number;
    contactedAfterMin?: number;
    message?: string;
    optedOut?: boolean;
    booking?: { daysAhead: number; slot: number };
  };

  // ASSUMPTION: all leads are fictional; phones are fake 98000000xx; emails use the reserved .test TLD.
  const LEADS: LeadSeed[] = [
    // SLA demo rows (NEW, no first contact yet): GREEN / AMBER / RED.
    {
      name: "Rohan Varma (sample)",
      phone: "9800000031",
      email: "rohan@example.test",
      source: "WEB",
      status: "NEW",
      variant: "model-h/zx-automatic-petrol",
      showroom: "gomti-nagar",
      citySlug: "lucknow",
      assignee: "asha",
      createdMinAgo: 1,
      message:
        "What is the on-road price of the ZX automatic in Lucknow? Looking to buy this month, need finance.",
    },
    {
      name: "Sunita Devi (sample)",
      phone: "9800000032",
      source: "PORTAL",
      status: "NEW",
      locale: "hi",
      variant: "model-s/lx-manual-cng",
      showroom: "gomti-nagar",
      citySlug: "lucknow",
      assignee: "asha",
      createdMinAgo: 4,
      message: "CNG वाली गाड़ी चाहिए, बजट 7 लाख तक। EMI कितनी होगी?",
    },
    {
      name: "Arjun Mishra (sample)",
      phone: "9800000033",
      email: "arjun@example.test",
      source: "SOCIAL",
      status: "NEW",
      model: "model-t",
      showroom: "gomti-nagar",
      citySlug: "lucknow",
      assignee: "ravi",
      createdMinAgo: 20,
      message: "Saw the Model T ad on Instagram. Is the turbo available in green?",
    },
    // MET: contacted within 2 min.
    {
      name: "Kavita Singh (sample)",
      phone: "9800000034",
      email: "kavita@example.test",
      source: "WEB",
      status: "CONTACTED",
      variant: "model-c/vx-cvt-petrol",
      showroom: "gomti-nagar",
      citySlug: "lucknow",
      assignee: "asha",
      createdMinAgo: 90,
      contactedAfterMin: 2,
      message: "Interested in an automatic sedan for daily office commute.",
    },
    // BREACHED: contacted after 12 min.
    {
      name: "Manoj Gupta (sample)",
      phone: "9800000035",
      source: "PORTAL",
      status: "CONTACTED",
      locale: "hi",
      variant: "model-c/vx-manual-diesel",
      showroom: "gomti-nagar",
      citySlug: "lucknow",
      assignee: "ravi",
      createdMinAgo: 180,
      contactedAfterMin: 12,
      message: "डीज़ल सेडान, हाईवे पर ज़्यादा चलती है।",
    },
    // Test-drive leads with future bookings.
    {
      name: "Priya Saxena (sample)",
      phone: "9800000036",
      email: "priya@example.test",
      source: "TEST_DRIVE",
      status: "TEST_DRIVE_BOOKED",
      variant: "model-h/zx-automatic-petrol",
      showroom: "gomti-nagar",
      citySlug: "lucknow",
      assignee: "asha",
      createdMinAgo: 300,
      contactedAfterMin: 3,
      booking: { daysAhead: 1, slot: 2 },
    },
    {
      name: "Aman Khan (sample)",
      phone: "9800000037",
      source: "TEST_DRIVE",
      status: "TEST_DRIVE_BOOKED",
      locale: "hi",
      variant: "model-s/vx-amt-petrol",
      showroom: "hazratganj",
      citySlug: "lucknow",
      assignee: "neha",
      createdMinAgo: 2,
      booking: { daysAhead: 2, slot: 0 },
    },
    {
      name: "Deepak Rawat (sample)",
      phone: "9800000038",
      email: "deepak@example.test",
      source: "TEST_DRIVE",
      status: "TEST_DRIVE_BOOKED",
      variant: "model-t/sx-turbo-automatic-petrol",
      showroom: "kanpur-mall-road",
      citySlug: "kanpur",
      assignee: "pooja",
      createdMinAgo: 240,
      contactedAfterMin: 4,
      booking: { daysAhead: 3, slot: 5 },
    },
    // Negotiation / won / lost.
    {
      name: "Farah Naqvi (sample)",
      phone: "9800000039",
      email: "farah@example.test",
      source: "WALKIN",
      status: "NEGOTIATION",
      variant: "model-h/zx-manual-diesel",
      showroom: "gomti-nagar",
      citySlug: "lucknow",
      assignee: "ravi",
      createdMinAgo: 3 * 24 * 60,
      contactedAfterMin: 1,
      message: "Walk-in. Wants exchange value for a 2016 hatchback.",
    },
    {
      name: "Sanjay Pandey (sample)",
      phone: "9800000040",
      source: "WALKIN",
      status: "WON",
      variant: "model-c/sx-manual-petrol",
      showroom: "hazratganj",
      citySlug: "lucknow",
      assignee: "imran",
      createdMinAgo: 9 * 24 * 60,
      contactedAfterMin: 1,
    },
    {
      name: "Meera Joshi (sample)",
      phone: "9800000041",
      email: "meera@example.test",
      source: "SOCIAL",
      status: "LOST",
      model: "model-s",
      showroom: "kanpur-mall-road",
      citySlug: "kanpur",
      assignee: "vikram",
      createdMinAgo: 6 * 24 * 60,
      contactedAfterMin: 25,
      message: "Comparing with another brand.",
    },
    // Used-car interest.
    {
      name: "Nitin Agarwal (sample)",
      phone: "9800000042",
      source: "WEB",
      status: "NEW",
      used: "UC-1182",
      showroom: "gomti-nagar",
      citySlug: "lucknow",
      assignee: "asha",
      createdMinAgo: 2,
      message: "Is UC-1182 still available? Can I see it on Sunday?",
    },
    {
      name: "Rekha Yadav (sample)",
      phone: "9800000043",
      source: "PORTAL",
      status: "CONTACTED",
      locale: "hi",
      used: "UC-1190",
      showroom: "hazratganj",
      citySlug: "lucknow",
      assignee: "neha",
      createdMinAgo: 2 * 24 * 60,
      contactedAfterMin: 3,
    },
    // Opted out (DPDP): no messages may be sent.
    {
      name: "Vivek Tripathi (sample)",
      phone: "9800000044",
      source: "WEB",
      status: "CONTACTED",
      variant: "model-t/ex-manual-petrol",
      showroom: "gomti-nagar",
      citySlug: "lucknow",
      assignee: "asha",
      createdMinAgo: 26 * 60,
      contactedAfterMin: 4,
      optedOut: true,
      message: "Please send brochure.",
    },
    {
      name: "Anjali Dubey (sample)",
      phone: "9800000045",
      email: "anjali@example.test",
      source: "WEB",
      status: "NEW",
      variant: "model-c/vx-cvt-petrol",
      showroom: "kanpur-mall-road",
      citySlug: "kanpur",
      assignee: "vikram",
      createdMinAgo: 7,
      message: "Need a quote for Kanpur.",
    },
  ];

  const leadIds: Record<string, string> = {};
  for (const l of LEADS) {
    const createdAt = ago(l.createdMinAgo * MIN);
    const firstContactAt =
      l.contactedAfterMin !== undefined
        ? new Date(createdAt.getTime() + l.contactedAfterMin * MIN)
        : null;
    const v = l.variant ? variant[l.variant] : undefined;
    const assignee = user[l.assignee];
    const sr = showroom[l.showroom];

    const lead = await db.lead.create({
      data: {
        name: l.name,
        phone: l.phone,
        email: l.email ?? null,
        source: l.source,
        status: l.status,
        locale: l.locale ?? "en",
        interestVariantId: v?.id ?? null,
        interestModelId: v?.modelId ?? (l.model ? model[l.model].id : null),
        interestUsedCarId: l.used ? usedCar[l.used] : null,
        showroomId: sr.id,
        citySlug: l.citySlug,
        message: l.message ?? null,
        assignedToId: assignee.id,
        consent: true,
        consentAt: createdAt,
        optedOut: l.optedOut ?? false,
        optedOutAt: l.optedOut ? ago(60 * MIN) : null,
        createdAt,
        firstContactAt,
      },
    });
    leadIds[l.phone] = lead.id;

    const acts: { type: string; note: string; actorId: string | null; createdAt: Date }[] = [
      {
        type: "CREATED",
        note: `Lead created from ${l.source.replace("_", " ").toLowerCase()}`,
        actorId: null,
        createdAt,
      },
      {
        type: "ASSIGNED",
        note: `Auto-assigned to ${assignee.name} (${sr.name})`,
        actorId: null,
        createdAt: new Date(createdAt.getTime() + 1000),
      },
    ];

    if (l.booking && v) {
      const demoCar = await db.demoCar.findFirstOrThrow({
        where: { showroomId: sr.id, variantId: v.id },
      });
      const slotStart = istSlot(l.booking.daysAhead, l.booking.slot);
      const reference = `TD-S${l.phone.slice(-4)}`;
      await db.testDriveBooking.create({
        data: {
          reference,
          demoCarId: demoCar.id,
          showroomId: sr.id,
          slotStart,
          slotEnd: new Date(slotStart.getTime() + 45 * MIN),
          leadId: lead.id,
        },
      });
      const when = slotStart.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
      acts.push({
        type: "TEST_DRIVE_BOOKED",
        note: `Test drive ${reference}: ${demoCar.label}, ${when} IST`,
        actorId: null,
        createdAt: new Date(createdAt.getTime() + 2000),
      });
      const body =
        (l.locale ?? "en") === "hi"
          ? `नमस्ते ${l.name}, आपकी टेस्ट ड्राइव बुक हो गई है। बुकिंग ID ${reference}, ${when} IST, ${sr.name}। ऑप्ट-आउट के लिए STOP लिखें।`
          : `Hi ${l.name}, your test drive is booked. Booking ID ${reference}, ${when} IST at ${sr.name}. Reply STOP to opt out.`;
      await db.messageLog.create({
        data: {
          leadId: lead.id,
          channel: "WHATSAPP",
          to: l.phone,
          template: "test_drive_ack",
          body,
          createdAt,
        },
      });
    } else {
      await db.messageLog.create({
        data: {
          leadId: lead.id,
          channel: "WHATSAPP",
          to: l.phone,
          template: "enquiry_ack",
          body:
            (l.locale ?? "en") === "hi"
              ? `नमस्ते ${l.name}, Brand X से संपर्क करने के लिए धन्यवाद। हमारे सलाहकार जल्द ही आपसे संपर्क करेंगे। ऑप्ट-आउट के लिए STOP लिखें।`
              : `Hi ${l.name}, thanks for contacting Brand X. A consultant will call you shortly. Reply STOP to opt out.`,
          createdAt,
        },
      });
    }

    if (firstContactAt) {
      acts.push({
        type: "CONTACTED",
        note: "Called the buyer",
        actorId: assignee.id,
        createdAt: firstContactAt,
      });
      if (l.status !== "CONTACTED" && l.status !== "TEST_DRIVE_BOOKED") {
        acts.push({
          type: "STATUS_CHANGED",
          note: `Status changed to ${l.status}`,
          actorId: assignee.id,
          createdAt: new Date(firstContactAt.getTime() + 30 * MIN),
        });
      }
    }
    if (l.optedOut) {
      await db.optOut.create({ data: { phone: l.phone, createdAt: ago(60 * MIN) } });
      acts.push({
        type: "OPTED_OUT",
        note: "Buyer opted out of messages",
        actorId: null,
        createdAt: ago(60 * MIN),
      });
    }

    await db.leadActivity.createMany({ data: acts.map((a) => ({ ...a, leadId: lead.id })) });
  }

  // A reassignment in the timeline (Farah: Asha → Ravi).
  await db.leadActivity.create({
    data: {
      leadId: leadIds["9800000039"],
      type: "REASSIGNED",
      note: `Reassigned from ${user.asha.name} to ${user.ravi.name}: Ravi handles diesel exchange deals`,
      actorId: user.admin.id,
      createdAt: ago(3 * 24 * 60 * MIN - 10 * MIN),
    },
  });

  // ── AI outputs: one OK summary, one FALLBACK draft ──
  // Stored shape matches src/server/ai: SUMMARY output = { summary }; DRAFT output = { text }, locale in input.
  await db.aiOutput.create({
    data: {
      leadId: leadIds["9800000034"],
      kind: "SUMMARY",
      input: { leadId: leadIds["9800000034"] },
      output: {
        summary: {
          needs: ["Automatic sedan", "Daily office commute"],
          budgetBand: "₹10–11 lakh",
          timeline: "Not stated",
          fuelPreference: "Petrol",
          missingInfo: ["Purchase timeline", "Finance or cash", "Exchange vehicle"],
          confidence: "medium",
        },
      },
      model: "seed",
      status: "OK",
      createdAt: ago(80 * MIN),
    },
  });
  await db.aiOutput.create({
    data: {
      leadId: leadIds["9800000035"],
      kind: "DRAFT",
      input: { leadId: leadIds["9800000035"], locale: "hi" },
      output: {
        text: "नमस्ते Manoj जी, Brand X में रुचि के लिए धन्यवाद। Model C VX Diesel के बारे में बात करने के लिए क्या मैं आपको आज कॉल कर सकता हूँ?",
      },
      model: "template",
      status: "FALLBACK",
      reason: "timeout",
      createdAt: ago(170 * MIN),
    },
  });

  await seedAiHistory(leadIds);
  await seedCms();

  const counts = {
    models: await db.model.count(),
    variants: await db.variant.count(),
    prices: await db.priceComponent.count(),
    demoCars: await db.demoCar.count(),
    usedCars: await db.usedCar.count(),
    users: await db.user.count(),
    leads: await db.lead.count(),
    bookings: await db.testDriveBooking.count(),
  };
  console.log("Seed complete:", counts);
}

// ─── CMS: offers & banners (ASSUMPTION: invented sample promotions) ─────────
// Upserted on fixed ids so re-running never duplicates; dates are relative to "now" so they stay live.
/**
 * Sample AI draft history so /admin/ai shows realistic behaviour, including the AI being wrong.
 * ASSUMPTION: invented examples; amounts match seeded price rows or are deliberately wrong.
 */
async function seedAiHistory(leadIds: Record<string, string>) {
  const H = 60 * MIN;
  const ok = (text: string) => ({ text, problem: null });
  const bad = (text: string, problem: string) => ({ text, problem });
  const drafts: {
    phone: string;
    hoursAgo: number;
    status: "OK" | "FALLBACK" | "BLOCKED";
    reason?: string;
    text: string;
    attempts: { text: string; problem: string | null }[];
    sent?: string;
  }[] = [
    {
      phone: "9800000031",
      hoursAgo: 200,
      status: "OK",
      text: "Hi Rohan, thanks for your interest in the Model H ZX Automatic. I can show you the car at Gomti Nagar this Saturday at 11 am or 3 pm. Which suits you?",
      attempts: [ok("…")],
      sent: "Hi Rohan, thanks for your interest in the Model H ZX Automatic. I can show you the car at Gomti Nagar this Saturday at 11 am or 3 pm. Which suits you?",
    },
    {
      phone: "9800000032",
      hoursAgo: 170,
      status: "OK",
      text: "Hi Sunita, thank you for asking about the Model S LX. I have free test-drive slots tomorrow at 10:30 am and 4 pm. Shall I book one for you?",
      attempts: [ok("…")],
      sent: "Hi Sunita ji, thank you for asking about the Model S LX CNG. I have free test-drive slots tomorrow at 10:30 am and 4 pm. Shall I book one for you?",
    },
    {
      phone: "9800000033",
      hoursAgo: 150,
      status: "OK",
      text: "Hi Arjun, thanks for your enquiry about the Model T. When would be a good time to call you about variants and the on-road price in Lucknow?",
      attempts: [bad("Hi Arjun, we have a special festive discount on the Model T this week!", "discount_language"), ok("…")],
      sent: "Hi Arjun, thanks for your enquiry about the Model T. When would be a good time to call you about variants and the on-road price in Lucknow?",
    },
    {
      phone: "9800000036",
      hoursAgo: 120,
      status: "BLOCKED",
      reason: "discount_language",
      text: "Hi Priya, thank you for contacting Brand X. I will call you shortly to understand what you are looking for. — Asha, Gomti Nagar",
      attempts: [
        bad("Hi Priya, I can get you ₹20,000 off and free accessories if you book today!", "discount_language"),
        bad("Hi Priya, ask me about our cashback offer on the Model C.", "discount_language"),
      ],
      sent: "Hi Priya, thank you for contacting Brand X. I'll call you in the next few minutes to understand what you're looking for, and share the on-road price for Kanpur. — Asha",
    },
    {
      phone: "9800000037",
      hoursAgo: 96,
      status: "BLOCKED",
      reason: "unverified_price",
      text: "Hi Aman, thank you for your interest in the Model C. I will call you shortly with the on-road price for your city. — Ravi",
      attempts: [
        bad("Hi Aman, the Model C VX will cost about ₹11,50,000 on-road.", "unverified_price"),
        bad("Hi Aman, the on-road price is roughly ₹11.5 lakh.", "unverified_price"),
      ],
    },
    {
      phone: "9800000038",
      hoursAgo: 72,
      status: "FALLBACK",
      reason: "timeout",
      text: "Hi Deepak, thank you for contacting Brand X. I will call you shortly. — Pooja, Hazratganj",
      attempts: [],
      sent: "Hi Deepak, thank you for contacting Brand X. I will call you shortly. — Pooja, Hazratganj",
    },
    {
      phone: "9800000040",
      hoursAgo: 30,
      status: "OK",
      text: "Hi Sanjay, thanks for asking about the certified Model C VX Diesel (UC-1182). It is available to see at our used-car yard. Would tomorrow at 12 pm work?",
      attempts: [ok("…")],
      sent: "Hi Sanjay, thanks for asking about the certified Model C VX Diesel (UC-1182). It's available at our used-car yard — would tomorrow at 12 pm work?",
    },
    {
      phone: "9800000041",
      hoursAgo: 6,
      status: "OK",
      text: "Hi Meera, thank you for your interest in the Model H. I have test-drive slots today at 5 pm and tomorrow at 11 am. Which would you prefer?",
      attempts: [ok("…")],
    },
  ];
  for (const d of drafts) {
    const leadId = leadIds[d.phone];
    if (!leadId) continue;
    const createdAt = ago(d.hoursAgo * H);
    await db.aiOutput.create({
      data: {
        leadId,
        kind: "DRAFT",
        input: { leadId, locale: "en", seeded: true },
        output: { text: d.text, attempts: d.attempts.map((a) => (a.text === "…" ? { ...a, text: d.text } : a)) },
        model: d.status === "OK" ? "seed" : "template",
        status: d.status,
        reason: d.reason ?? null,
        editedText: d.sent ?? null,
        sentAt: d.sent ? new Date(createdAt.getTime() + 4 * MIN) : null,
        createdAt,
      },
    });
  }
}

async function seedCms() {
  const modelH = await db.model.findUnique({ where: { slug: "model-h" }, select: { id: true } });
  const offers = [
    {
      id: "seed-offer-warranty",
      title: "Extended warranty on every new car",
      titleHi: "हर नई कार पर एक्सटेंडेड वारंटी",
      body: "Get 2 extra years of manufacturer-backed warranty when you book a new Brand X car this month.",
      bodyHi: "इस महीने कोई भी नई Brand X कार बुक करने पर 2 साल की अतिरिक्त कंपनी वारंटी पाएँ।",
      modelId: null,
      validFrom: ago(7 * DAY),
      validUntil: new Date(now.getTime() + 45 * DAY),
      sortOrder: 0,
    },
    {
      id: "seed-offer-model-h-service",
      title: "Model H: 3 free services",
      titleHi: "Model H: 3 मुफ़्त सर्विस",
      body: "Labour on the first three scheduled services is on us for Model H bookings.",
      bodyHi: "Model H की बुकिंग पर पहली तीन निर्धारित सर्विस का लेबर चार्ज हमारी ओर से।",
      modelId: modelH?.id ?? null,
      validFrom: ago(2 * DAY),
      validUntil: new Date(now.getTime() + 30 * DAY),
      sortOrder: 1,
    },
    {
      // Expired on purpose — must never appear on the site (shows "Expired" in admin).
      id: "seed-offer-expired",
      title: "Monsoon check-up camp",
      titleHi: "मानसून चेक-अप कैंप",
      body: "Free 20-point monsoon check-up at all Brand X workshops.",
      bodyHi: "सभी Brand X वर्कशॉप पर मुफ़्त 20-पॉइंट मानसून चेक-अप।",
      modelId: null,
      validFrom: ago(90 * DAY),
      validUntil: ago(30 * DAY),
      sortOrder: 2,
    },
  ];
  for (const { id, ...o } of offers) {
    if (o.modelId === null && id === "seed-offer-model-h-service") continue; // model missing
    await db.offer.upsert({ where: { id }, update: { ...o, isActive: true }, create: { id, ...o, isActive: true } });
  }

  const banners = [
    {
      id: "seed-banner-test-drive",
      title: "Test drive the Model H this weekend",
      titleHi: "इस वीकेंड Model H की टेस्ट ड्राइव लें",
      subtitle: "Pick a 45-minute slot at your nearest showroom — confirmed instantly.",
      subtitleHi: "अपने नज़दीकी शोरूम में 45 मिनट का स्लॉट चुनें — तुरंत कन्फ़र्म।",
      image: "/cars/model-h-side.svg",
      ctaLabel: "Book a test drive",
      ctaLabelHi: "टेस्ट ड्राइव बुक करें",
      ctaHref: "/test-drive?model=model-h",
      sortOrder: 0,
      startsAt: ago(1 * DAY),
      endsAt: new Date(now.getTime() + 30 * DAY),
    },
    {
      id: "seed-banner-used",
      title: "Certified used cars, inspected for you",
      titleHi: "सर्टिफ़ाइड यूज़्ड कारें, आपके लिए जाँची हुई",
      subtitle: "Every car comes with an inspection report and a clear asking price.",
      subtitleHi: "हर कार के साथ जाँच रिपोर्ट और साफ़ कीमत।",
      image: "/cars/model-c-side.svg",
      ctaLabel: "Browse used cars",
      ctaLabelHi: "यूज़्ड कारें देखें",
      ctaHref: "/used",
      sortOrder: 1,
      startsAt: null,
      endsAt: null,
    },
  ];
  for (const { id, ...b } of banners) {
    const data = { ...b, placement: "HOME", isActive: true };
    await db.banner.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
