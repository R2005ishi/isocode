/**
 * Admin CMS: offers and promotional banners. Route handlers enforce roles (ADMIN only);
 * these functions enforce data rules. Inputs are parsed by the schemas in `./cms.schema`.
 *
 * Offers are text only — they never change prices (admin price table is the only price source).
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/security/errors";
import {
  bannerIssues,
  liveBannerWhere,
  liveOfferWhere,
  toEndDate,
  toStartDate,
  type AdminBannerInput,
  type AdminBannerPatch,
  type AdminOfferInput,
  type AdminOfferPatch,
  type BannerPlacement,
} from "./cms.schema";

const offerInclude = {
  model: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.OfferInclude;

const offerOrder: Prisma.OfferOrderByWithRelationInput[] = [{ sortOrder: "asc" }, { validUntil: "asc" }];
const bannerOrder: Prisma.BannerOrderByWithRelationInput[] = [{ sortOrder: "asc" }, { createdAt: "desc" }];

async function assertModel(modelId: string | null | undefined) {
  if (!modelId) return;
  const m = await db.model.findUnique({ where: { id: modelId }, select: { id: true } });
  if (!m) throw badRequest("Model not found", { modelId: "Unknown model" });
}

// ─── Offers ────────────────────────────────────────────────────────────────
export function listOffers() {
  return db.offer.findMany({ orderBy: [{ isActive: "desc" }, ...offerOrder], include: offerInclude });
}

export async function getOffer(id: string) {
  const o = await db.offer.findUnique({ where: { id }, include: offerInclude });
  if (!o) throw notFound("Offer not found");
  return o;
}

export async function createOffer(input: AdminOfferInput) {
  await assertModel(input.modelId);
  return db.offer.create({
    data: {
      ...input,
      validFrom: toStartDate(input.validFrom),
      validUntil: toEndDate(input.validUntil),
    },
    include: offerInclude,
  });
}

export async function updateOffer(id: string, input: AdminOfferPatch) {
  const cur = await db.offer.findUnique({ where: { id }, select: { validFrom: true, validUntil: true } });
  if (!cur) throw notFound("Offer not found");
  await assertModel(input.modelId);
  const { validFrom, validUntil, ...rest } = input;
  const data: Prisma.OfferUncheckedUpdateInput = { ...rest };
  const from = validFrom !== undefined ? toStartDate(validFrom) : cur.validFrom;
  const until = validUntil !== undefined ? toEndDate(validUntil) : cur.validUntil;
  if (until < from) throw badRequest("Please check the dates", { validUntil: "Must be on or after the start date" });
  if (validFrom !== undefined) data.validFrom = from;
  if (validUntil !== undefined) data.validUntil = until;
  return db.offer.update({ where: { id }, data, include: offerInclude });
}

export async function deleteOffer(id: string) {
  const o = await db.offer.findUnique({ where: { id }, select: { id: true } });
  if (!o) throw notFound("Offer not found");
  await db.offer.delete({ where: { id } });
  return { ok: true as const };
}

/** Offers buyers see now: active, inside validFrom..validUntil, for this model or for all models. */
export function listLiveOffers(opts: { modelId?: string | null; now?: Date } = {}) {
  return db.offer.findMany({
    where: liveOfferWhere(opts.now ?? new Date(), opts.modelId),
    orderBy: offerOrder,
    take: 6,
    select: {
      id: true,
      title: true,
      titleHi: true,
      body: true,
      bodyHi: true,
      modelId: true,
      validFrom: true,
      validUntil: true,
    },
  });
}
export type LiveOffer = Awaited<ReturnType<typeof listLiveOffers>>[number];

// ─── Banners ───────────────────────────────────────────────────────────────
export function listBanners() {
  return db.banner.findMany({ orderBy: [{ placement: "asc" }, { isActive: "desc" }, ...bannerOrder] });
}

export async function getBanner(id: string) {
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) throw notFound("Banner not found");
  return b;
}

const dateOrNull = (s: string | null | undefined, end: boolean) =>
  s === undefined ? undefined : s === null ? null : end ? toEndDate(s) : toStartDate(s);

export function createBanner(input: AdminBannerInput) {
  return db.banner.create({
    data: {
      ...input,
      startsAt: dateOrNull(input.startsAt, false),
      endsAt: dateOrNull(input.endsAt, true),
    },
  });
}

export async function updateBanner(id: string, input: AdminBannerPatch) {
  const cur = await db.banner.findUnique({ where: { id } });
  if (!cur) throw notFound("Banner not found");

  const { startsAt, endsAt, ...rest } = input;
  const data: Prisma.BannerUpdateInput = { ...rest };
  if (startsAt !== undefined) data.startsAt = dateOrNull(startsAt, false);
  if (endsAt !== undefined) data.endsAt = dateOrNull(endsAt, true);

  // Re-check cross-field rules against the merged row.
  const fields = bannerIssues({
    ctaLabel: rest.ctaLabel !== undefined ? rest.ctaLabel : cur.ctaLabel,
    ctaHref: rest.ctaHref !== undefined ? rest.ctaHref : cur.ctaHref,
    startsAt: startsAt !== undefined ? (data.startsAt as Date | null) : cur.startsAt,
    endsAt: endsAt !== undefined ? (data.endsAt as Date | null) : cur.endsAt,
  });
  if (Object.keys(fields).length) throw badRequest("Please check the highlighted fields", fields);

  return db.banner.update({ where: { id }, data });
}

export async function deleteBanner(id: string) {
  const b = await db.banner.findUnique({ where: { id }, select: { id: true } });
  if (!b) throw notFound("Banner not found");
  await db.banner.delete({ where: { id } });
  return { ok: true as const };
}

/** Banners buyers see now for a placement: active and inside startsAt/endsAt when set. */
export function listLiveBanners(placement: BannerPlacement = "HOME", now: Date = new Date()) {
  return db.banner.findMany({
    where: liveBannerWhere(placement, now),
    orderBy: bannerOrder,
    take: 5,
    select: {
      id: true,
      title: true,
      titleHi: true,
      subtitle: true,
      subtitleHi: true,
      image: true,
      ctaLabel: true,
      ctaLabelHi: true,
      ctaHref: true,
    },
  });
}
export type LiveBanner = Awaited<ReturnType<typeof listLiveBanners>>[number];
