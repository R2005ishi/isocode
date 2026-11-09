-- CreateEnum
CREATE TYPE "ServiceBookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'TRADE_IN';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "importId" TEXT,
ADD COLUMN     "portalName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "specialtyModelIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "closeHour" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "openHour" INTEGER NOT NULL DEFAULT 9;

-- CreateTable
CREATE TABLE "ServiceBooking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "slotEnd" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "registration" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "odometerKm" INTEGER,
    "notes" TEXT,
    "consent" BOOLEAN NOT NULL,
    "consentAt" TIMESTAMP(3),
    "status" "ServiceBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeInRequest" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "variantName" TEXT,
    "year" INTEGER NOT NULL,
    "km" INTEGER NOT NULL,
    "owners" INTEGER NOT NULL DEFAULT 1,
    "fuel" "Fuel",
    "registration" TEXT,
    "expectedPrice" INTEGER,
    "condition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeInRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "portalName" TEXT NOT NULL,
    "importedById" TEXT,
    "totalRows" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "errors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleHi" TEXT,
    "body" TEXT NOT NULL,
    "bodyHi" TEXT,
    "modelId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleHi" TEXT,
    "subtitle" TEXT,
    "subtitleHi" TEXT,
    "image" TEXT,
    "ctaLabel" TEXT,
    "ctaLabelHi" TEXT,
    "ctaHref" TEXT,
    "placement" TEXT NOT NULL DEFAULT 'HOME',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceBooking_reference_key" ON "ServiceBooking"("reference");

-- CreateIndex
CREATE INDEX "ServiceBooking_workshopId_slotStart_status_idx" ON "ServiceBooking"("workshopId", "slotStart", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TradeInRequest_leadId_key" ON "TradeInRequest"("leadId");

-- CreateIndex
CREATE INDEX "Offer_isActive_validUntil_idx" ON "Offer"("isActive", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_portalName_externalRef_key" ON "Lead"("portalName", "externalRef");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_importId_fkey" FOREIGN KEY ("importId") REFERENCES "LeadImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeInRequest" ADD CONSTRAINT "TradeInRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

