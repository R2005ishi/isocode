-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUYER', 'CONSULTANT', 'ADMIN', 'USED_CAR_MANAGER');

-- CreateEnum
CREATE TYPE "Fuel" AS ENUM ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "UsedCarStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'SOLD');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEB', 'PORTAL', 'SOCIAL', 'WALKIN', 'TEST_DRIVE');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'TEST_DRIVE_BOOKED', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'hi');

-- CreateEnum
CREATE TYPE "AiKind" AS ENUM ('SUMMARY', 'DRAFT', 'PRICE_BAND');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('OK', 'FALLBACK', 'BLOCKED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BUYER',
    "phone" TEXT,
    "showroomId" TEXT,
    "lastAssignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameHi" TEXT,
    "slug" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Showroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cityId" TEXT,
    "phone" TEXT,
    "openHour" INTEGER NOT NULL DEFAULT 10,
    "closeHour" INTEGER NOT NULL DEFAULT 19,

    CONSTRAINT "Showroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "showroomId" TEXT,
    "bays" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bodyType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionHi" TEXT,
    "heroImage" TEXT NOT NULL,
    "gallery" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "fuel" "Fuel" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "exShowroomPrice" INTEGER NOT NULL,
    "specs" JSONB NOT NULL,
    "colours" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceComponent" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "roadTaxPct" DECIMAL(5,2) NOT NULL,
    "registrationFee" INTEGER NOT NULL,
    "insurance" INTEGER NOT NULL,
    "accessoriesPack" INTEGER NOT NULL,
    "otherCharges" INTEGER NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PriceComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedCar" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "fuel" "Fuel" NOT NULL,
    "transmission" "Transmission" NOT NULL DEFAULT 'MANUAL',
    "year" INTEGER NOT NULL,
    "km" INTEGER NOT NULL,
    "owners" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "UsedCarStatus" NOT NULL DEFAULT 'AVAILABLE',
    "registration" TEXT NOT NULL,
    "colour" TEXT,
    "images" TEXT[],
    "inspection" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsedCar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoCar" (
    "id" TEXT NOT NULL,
    "showroomId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DemoCar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestDriveBooking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "demoCarId" TEXT NOT NULL,
    "showroomId" TEXT NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "slotEnd" TIMESTAMP(3) NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestDriveBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "source" "LeadSource" NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "interestModelId" TEXT,
    "interestVariantId" TEXT,
    "interestUsedCarId" TEXT,
    "showroomId" TEXT,
    "citySlug" TEXT,
    "message" TEXT,
    "assignedToId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "consent" BOOLEAN NOT NULL,
    "consentAt" TIMESTAMP(3),
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstContactAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiOutput" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "kind" "AiKind" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AiStatus" NOT NULL,
    "reason" TEXT,
    "editedText" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "to" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptOut" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastSale" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "km" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Showroom_slug_key" ON "Showroom"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workshop_slug_key" ON "Workshop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Model_slug_key" ON "Model"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_code_key" ON "Variant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_modelId_slug_key" ON "Variant"("modelId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "PriceComponent_variantId_cityId_key" ON "PriceComponent"("variantId", "cityId");

-- CreateIndex
CREATE UNIQUE INDEX "UsedCar_stockId_key" ON "UsedCar"("stockId");

-- CreateIndex
CREATE UNIQUE INDEX "UsedCar_slug_key" ON "UsedCar"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TestDriveBooking_reference_key" ON "TestDriveBooking"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "TestDriveBooking_demoCarId_slotStart_key" ON "TestDriveBooking"("demoCarId", "slotStart");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_status_idx" ON "Lead"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "AiOutput_leadId_kind_createdAt_idx" ON "AiOutput"("leadId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OptOut_phone_key" ON "OptOut"("phone");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_showroomId_fkey" FOREIGN KEY ("showroomId") REFERENCES "Showroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_showroomId_fkey" FOREIGN KEY ("showroomId") REFERENCES "Showroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceComponent" ADD CONSTRAINT "PriceComponent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceComponent" ADD CONSTRAINT "PriceComponent_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoCar" ADD CONSTRAINT "DemoCar_showroomId_fkey" FOREIGN KEY ("showroomId") REFERENCES "Showroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoCar" ADD CONSTRAINT "DemoCar_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDriveBooking" ADD CONSTRAINT "TestDriveBooking_demoCarId_fkey" FOREIGN KEY ("demoCarId") REFERENCES "DemoCar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDriveBooking" ADD CONSTRAINT "TestDriveBooking_showroomId_fkey" FOREIGN KEY ("showroomId") REFERENCES "Showroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDriveBooking" ADD CONSTRAINT "TestDriveBooking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_interestModelId_fkey" FOREIGN KEY ("interestModelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_interestVariantId_fkey" FOREIGN KEY ("interestVariantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_interestUsedCarId_fkey" FOREIGN KEY ("interestUsedCarId") REFERENCES "UsedCar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_showroomId_fkey" FOREIGN KEY ("showroomId") REFERENCES "Showroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiOutput" ADD CONSTRAINT "AiOutput_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
