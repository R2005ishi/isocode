/**
 * Admin CRUD. Callers (route handlers) enforce roles; these functions enforce data rules.
 * Inputs are already parsed by the contract Admin*Schema / Admin*PatchSchema.
 */
import bcrypt from "bcryptjs";
import { Prisma, type UsedCar } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/security/errors";
import type { SessionUser } from "@/lib/security/guard";
import { maskRegistration } from "@/server/services/mask";
import type {
  AdminModelPatchSchema,
  AdminModelSchema,
  AdminPricePatchSchema,
  AdminPriceSchema,
  AdminUsedCarPatchSchema,
  AdminUsedCarSchema,
  AdminUserPatchSchema,
  AdminUserSchema,
  AdminVariantPatchSchema,
  AdminVariantSchema,
} from "@/types/contracts";

type In<S extends z.ZodTypeAny> = z.output<S>;

// ─── Lookups (dropdowns for the admin forms) ───────────────────────────────
export async function adminLookups() {
  const [cities, showrooms, models] = await Promise.all([
    db.city.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    db.showroom.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    db.model.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        variants: {
          select: { id: true, name: true, slug: true },
          orderBy: { exShowroomPrice: "asc" },
        },
      },
    }),
  ]);
  return { cities, showrooms, models };
}

// ─── Models ────────────────────────────────────────────────────────────────
export function listModels() {
  return db.model.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { variants: true, leads: true } } },
  });
}
export async function getModel(id: string) {
  const m = await db.model.findUnique({
    where: { id },
    include: { variants: { orderBy: { exShowroomPrice: "asc" } } },
  });
  if (!m) throw notFound("Model not found");
  return m;
}
export function createModel(input: In<typeof AdminModelSchema>) {
  return db.model.create({ data: input });
}
export function updateModel(id: string, input: In<typeof AdminModelPatchSchema>) {
  return db.model.update({ where: { id }, data: input });
}
/**
 * Hard delete only when nothing refers to it. A model with leads or test-drive bookings is kept for
 * history — the admin should deactivate it instead (hides it from the site).
 */
export async function deleteModel(id: string) {
  const m = await db.model.findUnique({ where: { id }, select: { id: true } });
  if (!m) throw notFound("Model not found");
  const [leads, bookings] = await Promise.all([
    db.lead.count({
      where: { OR: [{ interestModelId: id }, { interestVariant: { modelId: id } }] },
    }),
    db.testDriveBooking.count({ where: { demoCar: { variant: { modelId: id } } } }),
  ]);
  if (leads + bookings > 0) {
    throw conflict(
      `This model has ${leads} lead(s) and ${bookings} test-drive booking(s). Deactivate it instead of deleting so history is kept.`,
    );
  }
  await db.model.delete({ where: { id } });
  return { ok: true as const };
}

// ─── Variants ──────────────────────────────────────────────────────────────
export function listVariants(modelId?: string) {
  return db.variant.findMany({
    where: modelId ? { modelId } : undefined,
    orderBy: [{ model: { sortOrder: "asc" } }, { exShowroomPrice: "asc" }],
    include: { model: { select: { id: true, name: true, slug: true } } },
  });
}
export async function getVariant(id: string) {
  const v = await db.variant.findUnique({
    where: { id },
    include: { model: { select: { id: true, name: true, slug: true } } },
  });
  if (!v) throw notFound("Variant not found");
  return v;
}
async function assertModel(modelId: string) {
  const m = await db.model.findUnique({ where: { id: modelId }, select: { id: true } });
  if (!m) throw badRequest("Model not found", { modelId: "Unknown model" });
}
export async function createVariant(input: In<typeof AdminVariantSchema>) {
  await assertModel(input.modelId);
  return db.variant.create({ data: { ...input, code: input.code || null } });
}
export async function updateVariant(id: string, input: In<typeof AdminVariantPatchSchema>) {
  if (input.modelId) await assertModel(input.modelId);
  const data: Prisma.VariantUncheckedUpdateInput = { ...input };
  if (input.code !== undefined) data.code = input.code || null;
  return db.variant.update({ where: { id }, data });
}
export async function deleteVariant(id: string) {
  const v = await db.variant.findUnique({ where: { id }, select: { id: true } });
  if (!v) throw notFound("Variant not found");
  const [leads, bookings] = await Promise.all([
    db.lead.count({ where: { interestVariantId: id } }),
    db.testDriveBooking.count({ where: { demoCar: { variantId: id } } }),
  ]);
  if (leads + bookings > 0) {
    throw conflict(
      `This variant has ${leads} lead(s) and ${bookings} test-drive booking(s). Deactivate it instead of deleting so history is kept.`,
    );
  }
  await db.variant.delete({ where: { id } });
  return { ok: true as const };
}

// ─── Prices ────────────────────────────────────────────────────────────────
/** "YYYY-MM-DD" means valid until the end of that day in IST. */
function toValidUntil(s: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T23:59:59+05:30`) : new Date(s);
}

const priceInclude = {
  variant: {
    select: { id: true, name: true, exShowroomPrice: true, model: { select: { name: true } } },
  },
  city: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.PriceComponentInclude;
type PriceRow = Prisma.PriceComponentGetPayload<{ include: typeof priceInclude }>;

function priceDto(p: PriceRow) {
  return { ...p, roadTaxPct: Number(p.roadTaxPct) };
}

export async function listPrices(filter: { variantId?: string; cityId?: string }) {
  const rows = await db.priceComponent.findMany({
    where: { variantId: filter.variantId, cityId: filter.cityId },
    include: priceInclude,
    orderBy: [
      { variant: { model: { sortOrder: "asc" } } },
      { variant: { exShowroomPrice: "asc" } },
      { city: { name: "asc" } },
    ],
  });
  return rows.map(priceDto);
}

/** Upsert by (variantId, cityId) — one row per variant per city. */
export async function upsertPrice(user: SessionUser, input: In<typeof AdminPriceSchema>) {
  const [v, c] = await Promise.all([
    db.variant.findUnique({ where: { id: input.variantId }, select: { id: true } }),
    db.city.findUnique({ where: { id: input.cityId }, select: { id: true } }),
  ]);
  const fields: Record<string, string> = {};
  if (!v) fields.variantId = "Unknown variant";
  if (!c) fields.cityId = "Unknown city";
  if (Object.keys(fields).length) throw badRequest("Please check the highlighted fields", fields);

  const data = {
    roadTaxPct: new Prisma.Decimal(input.roadTaxPct),
    registrationFee: input.registrationFee,
    insurance: input.insurance,
    accessoriesPack: input.accessoriesPack,
    otherCharges: input.otherCharges,
    validUntil: toValidUntil(input.validUntil),
    updatedById: user.id,
  };
  const row = await db.priceComponent.upsert({
    where: { variantId_cityId: { variantId: input.variantId, cityId: input.cityId } },
    update: data,
    create: { variantId: input.variantId, cityId: input.cityId, ...data },
    include: priceInclude,
  });
  return priceDto(row);
}

export async function updatePrice(
  user: SessionUser,
  id: string,
  input: In<typeof AdminPricePatchSchema>,
) {
  const data: Prisma.PriceComponentUncheckedUpdateInput = { updatedById: user.id };
  if (input.roadTaxPct !== undefined) data.roadTaxPct = new Prisma.Decimal(input.roadTaxPct);
  if (input.registrationFee !== undefined) data.registrationFee = input.registrationFee;
  if (input.insurance !== undefined) data.insurance = input.insurance;
  if (input.accessoriesPack !== undefined) data.accessoriesPack = input.accessoriesPack;
  if (input.otherCharges !== undefined) data.otherCharges = input.otherCharges;
  if (input.validUntil !== undefined) data.validUntil = toValidUntil(input.validUntil);
  // variantId/cityId are the row's identity; moving a row is a delete + create.
  if (input.variantId !== undefined || input.cityId !== undefined) {
    const cur = await db.priceComponent.findUnique({
      where: { id },
      select: { variantId: true, cityId: true },
    });
    if (!cur) throw notFound("Price row not found");
    if (
      (input.variantId && input.variantId !== cur.variantId) ||
      (input.cityId && input.cityId !== cur.cityId)
    ) {
      throw badRequest(
        "Variant and city of a price row cannot be changed; create a new row instead.",
      );
    }
  }
  const row = await db.priceComponent.update({ where: { id }, data, include: priceInclude });
  return priceDto(row);
}

export async function deletePrice(id: string) {
  await db.priceComponent.delete({ where: { id } });
  return { ok: true as const };
}

// ─── Used cars ─────────────────────────────────────────────────────────────
/** Full registration only for ADMIN; everyone else (incl. USED_CAR_MANAGER) gets the masked form. */
export function usedCarDto(car: UsedCar, viewer: SessionUser) {
  const { registration, ...rest } = car;
  return {
    ...rest,
    registrationMasked: maskRegistration(registration),
    ...(viewer.role === "ADMIN" ? { registration } : {}),
  };
}

export async function listUsedCars(viewer: SessionUser) {
  const cars = await db.usedCar.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return cars.map((c) => usedCarDto(c, viewer));
}
export async function getUsedCar(viewer: SessionUser, id: string) {
  const car = await db.usedCar.findUnique({ where: { id } });
  if (!car) throw notFound("Used car not found");
  return usedCarDto(car, viewer);
}
const normReg = (r: string) => r.replace(/\s+/g, " ").trim();
export async function createUsedCar(viewer: SessionUser, input: In<typeof AdminUsedCarSchema>) {
  const car = await db.usedCar.create({
    data: { ...input, registration: normReg(input.registration) },
  });
  return usedCarDto(car, viewer);
}
export async function updateUsedCar(
  viewer: SessionUser,
  id: string,
  input: In<typeof AdminUsedCarPatchSchema>,
) {
  const data: Prisma.UsedCarUpdateInput = { ...input };
  if (input.registration) data.registration = normReg(input.registration);
  const car = await db.usedCar.update({ where: { id }, data });
  return usedCarDto(car, viewer);
}
export async function deleteUsedCar(id: string) {
  const car = await db.usedCar.findUnique({ where: { id }, select: { id: true } });
  if (!car) throw notFound("Used car not found");
  const leads = await db.lead.count({ where: { interestUsedCarId: id } });
  if (leads > 0)
    throw conflict(
      `This car has ${leads} lead(s). Mark it SOLD instead of deleting so history is kept.`,
    );
  await db.usedCar.delete({ where: { id } });
  return { ok: true as const };
}

// ─── Users ─────────────────────────────────────────────────────────────────
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  showroomId: true,
  isActive: true,
  createdAt: true,
  specialtyModelIds: true,
  showroom: { select: { name: true } },
} satisfies Prisma.UserSelect; // never passwordHash

export function listUsers() {
  return db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], select: userSelect });
}
export async function getUser(id: string) {
  const u = await db.user.findUnique({ where: { id }, select: userSelect });
  if (!u) throw notFound("User not found");
  return u;
}
async function assertShowroom(showroomId: string | null | undefined) {
  if (!showroomId) return;
  const s = await db.showroom.findUnique({ where: { id: showroomId }, select: { id: true } });
  if (!s) throw badRequest("Showroom not found", { showroomId: "Unknown showroom" });
}
/** Dedupes and checks specialty model ids exist. */
async function cleanSpecialties(ids: string[] | undefined): Promise<string[] | undefined> {
  if (ids === undefined) return undefined;
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const found = await db.model.count({ where: { id: { in: unique } } });
  if (found !== unique.length)
    throw badRequest("Unknown model in specialties", { specialtyModelIds: "Unknown model" });
  return unique;
}
export async function createUser(input: In<typeof AdminUserSchema>) {
  if (!input.password)
    throw badRequest("Password is required", { password: "Set a password (min 8 characters)" });
  await assertShowroom(input.showroomId);
  const specialtyModelIds = (await cleanSpecialties(input.specialtyModelIds)) ?? [];
  const { password, ...rest } = input;
  return db.user.create({
    data: {
      ...rest,
      specialtyModelIds,
      showroomId: rest.showroomId || null,
      passwordHash: await bcrypt.hash(password, 10),
    },
    select: userSelect,
  });
}
export async function updateUser(
  actor: SessionUser,
  id: string,
  input: In<typeof AdminUserPatchSchema>,
) {
  if (id === actor.id && ((input.role && input.role !== "ADMIN") || input.isActive === false)) {
    throw conflict("You cannot demote or deactivate your own account.");
  }
  await assertShowroom(input.showroomId);
  const specialtyModelIds = await cleanSpecialties(input.specialtyModelIds);
  const { password, ...rest } = { ...input, specialtyModelIds };
  const data: Prisma.UserUncheckedUpdateInput = { ...rest };
  if (rest.showroomId !== undefined) data.showroomId = rest.showroomId || null;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  return db.user.update({ where: { id }, data, select: userSelect });
}
/** Users are never hard-deleted (they own lead history); "delete" deactivates. */
export async function deactivateUser(actor: SessionUser, id: string) {
  if (id === actor.id) throw conflict("You cannot deactivate your own account.");
  return db.user.update({ where: { id }, data: { isActive: false }, select: userSelect });
}
