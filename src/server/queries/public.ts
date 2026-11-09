/**
 * Catalogue reads for the public (buyer) pages. Server-only.
 *
 * Privacy rule: used-car queries use an explicit `select`. The full registration number is read
 * only to compute `registrationMasked` inside this module and is never part of a returned object.
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CITY_COOKIE, DEFAULT_CITY } from "@/i18n/config";
import { maskRegistration } from "@/server/services/mask";
import { computeOnRoad } from "@/server/services/pricing";
import type { UsedCarFilter, UsedCarPublic } from "@/types/contracts";

export type CityOption = { slug: string; name: string; nameHi: string | null };
export type Colour = { name: string; nameHi?: string; hex: string };
export type Specs = Record<string, string | number>;

// ─── Cities ────────────────────────────────────────────────────────────────

export const listCities = cache(async (): Promise<CityOption[]> => {
  return db.city.findMany({ select: { slug: true, name: true, nameHi: true }, orderBy: { name: "asc" } });
});

/** City from the `city` cookie, falling back to Lucknow (or the first city) if unknown. */
export const getSelectedCity = cache(async (): Promise<CityOption> => {
  const [store, cities] = await Promise.all([cookies(), listCities()]);
  const wanted = store.get(CITY_COOKIE)?.value ?? DEFAULT_CITY;
  return (
    cities.find((c) => c.slug === wanted) ??
    cities.find((c) => c.slug === DEFAULT_CITY) ??
    cities[0] ?? { slug: DEFAULT_CITY, name: "Lucknow", nameHi: "लखनऊ" }
  );
});

// ─── Prices (admin table only; same computation as the pricing service) ───

type PriceRow = Prisma.PriceComponentGetPayload<{
  select: {
    variantId: true;
    roadTaxPct: true;
    registrationFee: true;
    insurance: true;
    accessoriesPack: true;
    otherCharges: true;
    validUntil: true;
    city: { select: { slug: true; name: true } };
  };
}>;

async function onRoadTotals(
  variants: { id: string; exShowroomPrice: number }[],
  citySlug: string,
): Promise<Map<string, { total: number; isExpired: boolean }>> {
  if (variants.length === 0) return new Map();
  const rows: PriceRow[] = await db.priceComponent.findMany({
    where: { variantId: { in: variants.map((v) => v.id) }, city: { slug: citySlug } },
    select: {
      variantId: true,
      roadTaxPct: true,
      registrationFee: true,
      insurance: true,
      accessoriesPack: true,
      otherCharges: true,
      validUntil: true,
      city: { select: { slug: true, name: true } },
    },
  });
  const ex = new Map(variants.map((v) => [v.id, v.exShowroomPrice]));
  const out = new Map<string, { total: number; isExpired: boolean }>();
  for (const r of rows) {
    const b = computeOnRoad(
      ex.get(r.variantId)!,
      {
        roadTaxPct: Number(r.roadTaxPct),
        registrationFee: r.registrationFee,
        insurance: r.insurance,
        accessoriesPack: r.accessoriesPack,
        otherCharges: r.otherCharges,
        validUntil: r.validUntil,
      },
      { variantId: r.variantId, citySlug: r.city.slug, cityName: r.city.name },
    );
    out.set(r.variantId, { total: b.total, isExpired: b.isExpired });
  }
  return out;
}

// ─── Models & variants ─────────────────────────────────────────────────────

const variantSelect = {
  id: true,
  name: true,
  slug: true,
  code: true,
  fuel: true,
  transmission: true,
  exShowroomPrice: true,
  specs: true,
  colours: true,
} satisfies Prisma.VariantSelect;

type VariantRow = Prisma.VariantGetPayload<{ select: typeof variantSelect }>;

export type VariantSummary = Omit<VariantRow, "specs" | "colours"> & {
  specs: Specs;
  colours: Colour[];
  onRoadFrom: number | null; // null → no admin price row for the city
  priceExpired: boolean;
};

export type ModelSummary = {
  id: string;
  name: string;
  slug: string;
  bodyType: string;
  description: string;
  heroImage: string;
  gallery: string[];
  variantCount: number;
  exShowroomFrom: number | null;
  onRoadFrom: number | null;
};

function toVariant(v: VariantRow, totals: Map<string, { total: number; isExpired: boolean }>): VariantSummary {
  const t = totals.get(v.id);
  return {
    ...v,
    specs: (v.specs ?? {}) as Specs,
    colours: (Array.isArray(v.colours) ? v.colours : []) as Colour[],
    onRoadFrom: t?.total ?? null,
    priceExpired: t?.isExpired ?? false,
  };
}

function minOrNull(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.min(...v) : null;
}

export const listModels = cache(async (citySlug: string, locale: string): Promise<ModelSummary[]> => {
  const models = await db.model.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      bodyType: true,
      description: true,
      descriptionHi: true,
      heroImage: true,
      gallery: true,
      variants: { where: { isActive: true }, select: { id: true, exShowroomPrice: true } },
    },
  });
  const totals = await onRoadTotals(models.flatMap((m) => m.variants), citySlug);
  return models.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    bodyType: m.bodyType,
    description: (locale === "hi" && m.descriptionHi) || m.description,
    heroImage: m.heroImage,
    gallery: m.gallery,
    variantCount: m.variants.length,
    exShowroomFrom: minOrNull(m.variants.map((v) => v.exShowroomPrice)),
    onRoadFrom: minOrNull(m.variants.map((v) => totals.get(v.id)?.total ?? null)),
  }));
});

export type ModelDetail = ModelSummary & { variants: VariantSummary[] };

export const getModel = cache(
  async (slug: string, citySlug: string, locale: string): Promise<ModelDetail | null> => {
    const m = await db.model.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        bodyType: true,
        description: true,
        descriptionHi: true,
        heroImage: true,
        gallery: true,
        variants: {
          where: { isActive: true },
          orderBy: { exShowroomPrice: "asc" },
          select: variantSelect,
        },
      },
    });
    if (!m) return null;
    const totals = await onRoadTotals(m.variants, citySlug);
    const variants = m.variants.map((v) => toVariant(v, totals));
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      bodyType: m.bodyType,
      description: (locale === "hi" && m.descriptionHi) || m.description,
      heroImage: m.heroImage,
      gallery: m.gallery.length ? m.gallery : [m.heroImage],
      variantCount: variants.length,
      exShowroomFrom: minOrNull(variants.map((v) => v.exShowroomPrice)),
      onRoadFrom: minOrNull(variants.map((v) => v.onRoadFrom)),
      variants,
    };
  },
);

// ─── Used cars ─────────────────────────────────────────────────────────────

/** Explicit select. `registration` is read only to mask it below. */
const usedSelect = {
  id: true,
  stockId: true,
  slug: true,
  modelName: true,
  variantName: true,
  fuel: true,
  transmission: true,
  year: true,
  km: true,
  owners: true,
  price: true,
  status: true,
  registration: true,
  colour: true,
  images: true,
  inspection: true,
} satisfies Prisma.UsedCarSelect;

type UsedRow = Prisma.UsedCarGetPayload<{ select: typeof usedSelect }>;

function toUsedPublic(row: UsedRow): UsedCarPublic {
  const { registration, inspection, ...rest } = row;
  return {
    ...rest,
    registrationMasked: maskRegistration(registration),
    inspection: (Array.isArray(inspection) ? inspection : []) as UsedCarPublic["inspection"],
  };
}

export async function listUsedCars(f: UsedCarFilter = {}): Promise<UsedCarPublic[]> {
  const rows = await db.usedCar.findMany({
    where: {
      modelName: f.model ? { equals: f.model, mode: "insensitive" } : undefined,
      fuel: f.fuel,
      year: f.minYear ? { gte: f.minYear } : undefined,
      km: f.maxKm !== undefined ? { lte: f.maxKm } : undefined,
      price: f.maxPrice !== undefined ? { lte: f.maxPrice } : undefined,
      status: f.status,
    },
    // Available first, then newest stock.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: usedSelect,
  });
  return rows.map(toUsedPublic);
}

export const getUsedCar = cache(async (slug: string): Promise<UsedCarPublic | null> => {
  const row = await db.usedCar.findUnique({ where: { slug }, select: usedSelect });
  return row ? toUsedPublic(row) : null;
});

export async function usedCarModelNames(): Promise<string[]> {
  const rows = await db.usedCar.findMany({
    distinct: ["modelName"],
    select: { modelName: true },
    orderBy: { modelName: "asc" },
  });
  return rows.map((r) => r.modelName);
}

// ─── Test-drive options ────────────────────────────────────────────────────

export type BookingShowroom = {
  id: string;
  name: string;
  address: string;
  demoCars: {
    id: string;
    label: string;
    variantId: string;
    modelSlug: string;
    modelName: string;
    variantName: string;
    image: string;
  }[];
};

export async function listBookingOptions(): Promise<BookingShowroom[]> {
  const rows = await db.showroom.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      demoCars: {
        where: { isActive: true, variant: { isActive: true, model: { isActive: true } } },
        orderBy: [{ variant: { model: { sortOrder: "asc" } } }, { variant: { exShowroomPrice: "asc" } }],
        select: {
          id: true,
          label: true,
          variantId: true,
          variant: { select: { name: true, model: { select: { name: true, slug: true, heroImage: true } } } },
        },
      },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    demoCars: s.demoCars.map((d) => ({
      id: d.id,
      label: d.label,
      variantId: d.variantId,
      modelSlug: d.variant.model.slug,
      modelName: d.variant.model.name,
      variantName: d.variant.name,
      image: d.variant.model.heroImage,
    })),
  }));
}

// ─── Sitemap ───────────────────────────────────────────────────────────────

export async function sitemapEntries() {
  const [models, used] = await Promise.all([
    db.model.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        variants: { where: { isActive: true }, select: { slug: true } },
      },
    }),
    db.usedCar.findMany({ where: { status: { not: "SOLD" } }, select: { slug: true, updatedAt: true } }),
  ]);
  return { models, used };
}

/** Non-personal booking facts for the confirmation page (reference is the only key). */
export async function getBookingSummary(reference: string) {
  return db.testDriveBooking.findUnique({
    where: { reference },
    select: {
      reference: true,
      slotStart: true,
      slotEnd: true,
      status: true,
      showroom: { select: { name: true, address: true } },
      demoCar: { select: { variant: { select: { name: true, model: { select: { name: true } } } } } },
    },
  });
}
