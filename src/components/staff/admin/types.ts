/**
 * Wire shapes of the admin API (src/server/workflows/admin.ts), with Dates as ISO strings.
 * The contract file only defines input schemas for admin, so the output DTOs are mirrored here.
 */
import type { z } from "zod";
import type { FuelEnum, Role, TransmissionEnum, UsedCarPublic, UsedCarStatusEnum } from "@/types/contracts";

export type Fuel = z.infer<typeof FuelEnum>;
export type Transmission = z.infer<typeof TransmissionEnum>;
export type UsedCarStatus = z.infer<typeof UsedCarStatusEnum>;

export type AdminLookups = {
  cities: { id: string; name: string; slug: string }[];
  showrooms: { id: string; name: string; slug: string }[];
  models: { id: string; name: string; slug: string; variants: { id: string; name: string; slug: string }[] }[];
};

export type AdminModel = {
  id: string;
  name: string;
  slug: string;
  bodyType: string;
  description: string;
  descriptionHi: string | null;
  heroImage: string;
  gallery: string[];
  isActive: boolean;
  sortOrder: number;
  _count?: { variants: number; leads: number };
};

export type Colour = { name: string; nameHi?: string; hex: string };

export type AdminVariant = {
  id: string;
  modelId: string;
  name: string;
  slug: string;
  code: string | null;
  fuel: Fuel;
  transmission: Transmission;
  exShowroomPrice: number;
  specs: Record<string, string | number>;
  colours: Colour[];
  isActive: boolean;
  model: { id: string; name: string; slug: string };
};

export type AdminPrice = {
  id: string;
  variantId: string;
  cityId: string;
  roadTaxPct: number;
  registrationFee: number;
  insurance: number;
  accessoriesPack: number;
  otherCharges: number;
  validUntil: string;
  updatedAt: string;
  variant: { id: string; name: string; exShowroomPrice: number; model: { name: string } };
  city: { id: string; name: string; slug: string };
};

export type InspectionItem = UsedCarPublic["inspection"][number];

export type AdminUsedCar = {
  id: string;
  stockId: string;
  slug: string;
  modelName: string;
  variantName: string;
  fuel: Fuel;
  transmission: Transmission;
  year: number;
  km: number;
  owners: number;
  price: number;
  status: UsedCarStatus;
  /** Present only for ADMIN viewers. */
  registration?: string;
  registrationMasked: string;
  colour: string | null;
  images: string[];
  inspection: InspectionItem[];
  createdAt: string;
  updatedAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  showroomId: string | null;
  isActive: boolean;
  createdAt: string;
  specialtyModelIds: string[];
  showroom: { name: string } | null;
};
