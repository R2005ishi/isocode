/**
 * Portal CSV lead import (ADMIN). Rows are mapped by the pure `mapCsvToLeads`, then each valid row
 * is created in its own small transaction so one bad row never aborts the batch.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/security/errors";
import type { SessionUser } from "@/lib/security/guard";
import { assignLead, OPEN_LEAD_STATUSES } from "@/server/services/assignment";
import {
  canonicalPortalName,
  ImportFileError,
  mapCsvToLeads,
  type ImportLookups,
  type ImportRowIssue,
  type LeadImportPreviewRow,
  type LeadImportRequestSchema,
  type LeadImportResult,
  type LeadImportSummary,
  type MappedLead,
} from "@/server/services/lead-import";
import { maskPhone } from "@/server/services/mask";
import type { z } from "zod";

const PREVIEW_ROWS = 25;

async function importLookups(): Promise<ImportLookups> {
  const [cities, showrooms, models] = await Promise.all([
    db.city.findMany({ select: { id: true, name: true, slug: true } }),
    db.showroom.findMany({ select: { id: true, name: true, slug: true, cityId: true } }),
    db.model.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        variants: { select: { id: true, name: true, slug: true, code: true } },
      },
    }),
  ]);
  const citySlugById = new Map(cities.map((c) => [c.id, c.slug]));
  return {
    cities,
    showrooms: showrooms.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      citySlug: s.cityId ? (citySlugById.get(s.cityId) ?? null) : null,
    })),
    models,
  };
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function importPortalLeads(
  user: SessionUser,
  input: z.output<typeof LeadImportRequestSchema>,
): Promise<LeadImportResult> {
  const portalName = canonicalPortalName(input.portalName);
  const fileName = input.fileName.trim();
  if (input.defaultShowroomId) {
    const s = await db.showroom.findUnique({
      where: { id: input.defaultShowroomId },
      select: { id: true },
    });
    if (!s) throw badRequest("Showroom not found", { defaultShowroomId: "Unknown showroom" });
  }

  const lookups = await importLookups();
  let mapped;
  try {
    mapped = mapCsvToLeads(input.csvText, lookups, { defaultShowroomId: input.defaultShowroomId });
  } catch (e) {
    if (e instanceof ImportFileError) throw badRequest(e.message, { csvText: e.message });
    throw e;
  }

  // Pre-check duplicates/opt-outs in bulk so the dry run is accurate too.
  const phones = mapped.valid.map((v) => v.phone);
  const refs = mapped.valid.map((v) => v.externalRef).filter((r): r is string => !!r);
  const [optOuts, openLeads, existingRefs] = await Promise.all([
    db.optOut.findMany({ where: { phone: { in: phones } }, select: { phone: true } }),
    db.lead.findMany({
      where: { phone: { in: phones }, status: { in: [...OPEN_LEAD_STATUSES] } },
      select: { phone: true },
    }),
    refs.length
      ? db.lead.findMany({
          where: { portalName, externalRef: { in: refs } },
          select: { externalRef: true },
        })
      : Promise.resolve([] as { externalRef: string | null }[]),
  ]);
  const optedOut = new Set(optOuts.map((o) => o.phone));
  const hasOpen = new Set(openLeads.map((l) => l.phone));
  const knownRefs = new Set(existingRefs.map((l) => l.externalRef));

  const skipReason = (v: MappedLead): string | null => {
    if (v.externalRef && knownRefs.has(v.externalRef))
      return `Already imported from ${portalName} (lead id ${v.externalRef})`;
    if (optedOut.has(v.phone)) return "Phone is on the opt-out register";
    if (hasOpen.has(v.phone)) return "Phone already has an open lead";
    return null;
  };

  const errors: ImportRowIssue[] = [...mapped.errors];
  const toCreate: MappedLead[] = [];
  for (const v of mapped.valid) {
    const reason = skipReason(v);
    if (reason) errors.push({ row: v.row, reason });
    else toCreate.push(v);
  }

  const nameOf = <T extends { id: string; name: string }>(list: T[], id: string | null) =>
    id ? (list.find((x) => x.id === id)?.name ?? null) : null;
  const variants = lookups.models.flatMap((m) => m.variants);
  const cityName = (slug: string | null) =>
    slug ? (lookups.cities.find((c) => c.slug === slug)?.name ?? slug) : null;
  const buildPreview = (issues: ImportRowIssue[]): LeadImportPreviewRow[] => {
    const errorByRow = new Map(issues.map((e) => [e.row, e.reason]));
    return mapped.valid.slice(0, PREVIEW_ROWS).map((v) => {
      const reason = errorByRow.get(v.row);
      return {
        row: v.row,
        name: v.name,
        phoneMasked: maskPhone(v.phone),
        model: nameOf(lookups.models, v.modelId),
        variant: nameOf(variants, v.variantId),
        showroom: nameOf(lookups.showrooms, v.showroomId),
        city: cityName(v.citySlug),
        externalRef: v.externalRef,
        outcome: reason ? "skip" : "create",
        ...(reason ? { reason } : {}),
      };
    });
  };

  const base = {
    portalName,
    fileName,
    totalRows: mapped.totalRows,
    warnings: mapped.warnings,
    headerMap: mapped.headerMap,
    ignoredHeaders: mapped.ignoredHeaders,
  };

  if (input.dryRun) {
    return {
      ...base,
      dryRun: true,
      importId: null,
      createdCount: toCreate.length,
      skippedCount: errors.length,
      errors: errors.sort((a, b) => a.row - b.row),
      preview: buildPreview(errors),
    };
  }

  const batch = await db.leadImport.create({
    data: {
      fileName,
      portalName,
      importedById: user.id,
      totalRows: mapped.totalRows,
      createdCount: 0,
      skippedCount: 0,
      errors: [],
    },
    select: { id: true },
  });

  let created = 0;
  for (const v of toCreate) {
    try {
      await db.$transaction(async (tx) => {
        // Re-check inside the transaction (another import or a web form may have raced us).
        const [optOut, open] = await Promise.all([
          tx.optOut.findUnique({ where: { phone: v.phone }, select: { id: true } }),
          tx.lead.findFirst({
            where: { phone: v.phone, status: { in: [...OPEN_LEAD_STATUSES] } },
            select: { id: true },
          }),
        ]);
        if (optOut) throw new RowSkip("Phone is on the opt-out register");
        if (open) throw new RowSkip("Phone already has an open lead");

        const now = new Date();
        const lead = await tx.lead.create({
          data: {
            name: v.name,
            phone: v.phone,
            email: v.email,
            source: "PORTAL",
            status: "NEW",
            locale: "en",
            interestModelId: v.modelId,
            interestVariantId: v.variantId,
            showroomId: v.showroomId,
            citySlug: v.citySlug,
            message: v.message,
            // ASSUMPTION: the buyer consented on the portal, which shares the lead with the dealer.
            consent: true,
            consentAt: now,
            portalName,
            externalRef: v.externalRef,
            importId: batch.id,
          },
          select: { id: true },
        });
        const portalDate = v.portalCreatedAt ? `, enquired ${v.portalCreatedAt.toISOString()}` : "";
        const ref = v.externalRef ? `, lead id ${v.externalRef}` : "";
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            actorId: user.id,
            type: "CREATED",
            note: `Imported from ${portalName} (${fileName})${ref}${portalDate}`.slice(0, 500),
          },
        });
        await assignLead(tx, lead.id, v.showroomId, v.modelId);
      });
      created++;
    } catch (e) {
      if (e instanceof RowSkip) errors.push({ row: v.row, reason: e.message });
      else if (isUniqueViolation(e))
        errors.push({
          row: v.row,
          reason: `Already imported from ${portalName} (lead id ${v.externalRef})`,
        });
      else {
        console.error("[lead-import] row failed", v.row, e);
        errors.push({ row: v.row, reason: "Could not save this row" });
      }
    }
  }

  errors.sort((a, b) => a.row - b.row);
  await db.leadImport.update({
    where: { id: batch.id },
    data: { createdCount: created, skippedCount: errors.length, errors },
  });

  return {
    ...base,
    dryRun: false,
    importId: batch.id,
    createdCount: created,
    skippedCount: errors.length,
    errors,
    preview: buildPreview(errors),
  };
}

class RowSkip extends Error {}

function toSummary(r: {
  id: string;
  fileName: string;
  portalName: string;
  importedBy: { id: string; name: string } | null;
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  errors: Prisma.JsonValue;
  createdAt: Date;
}): LeadImportSummary {
  return {
    ...r,
    errors: Array.isArray(r.errors) ? (r.errors as ImportRowIssue[]) : [],
    createdAt: r.createdAt.toISOString(),
  };
}

const summarySelect = {
  id: true,
  fileName: true,
  portalName: true,
  importedBy: { select: { id: true, name: true } },
  totalRows: true,
  createdCount: true,
  skippedCount: true,
  errors: true,
  createdAt: true,
} satisfies Prisma.LeadImportSelect;

export async function listLeadImports(limit = 50): Promise<LeadImportSummary[]> {
  const rows = await db.leadImport.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: summarySelect,
  });
  return rows.map(toSummary);
}

export async function getLeadImport(id: string): Promise<LeadImportSummary> {
  const r = await db.leadImport.findUnique({ where: { id }, select: summarySelect });
  if (!r) throw notFound("Import not found");
  return toSummary(r);
}
