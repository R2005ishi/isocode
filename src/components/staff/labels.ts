import { formatDateIST } from "@/lib/format";
import type { LeadListItem, LeadStatus, Role, SlaState } from "@/types/contracts";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TEST_DRIVE_BOOKED: "Test drive booked",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};
export const STATUS_ORDER: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "TEST_DRIVE_BOOKED",
  "NEGOTIATION",
  "WON",
  "LOST",
];

export const SOURCE_LABEL: Record<LeadListItem["source"], string> = {
  WEB: "Website",
  PORTAL: "Portal",
  SOCIAL: "Social",
  WALKIN: "Walk-in",
  TEST_DRIVE: "Test drive",
  TRADE_IN: "Trade-in",
};

export const SLA_LABEL: Record<SlaState, string> = {
  GREEN: "On time",
  AMBER: "Hurry",
  RED: "Overdue",
  MET: "Met",
  BREACHED: "Late",
};

export const ROLE_LABEL: Record<Role, string> = {
  BUYER: "Buyer",
  CONSULTANT: "Sales consultant",
  ADMIN: "Admin",
  USED_CAR_MANAGER: "Used-car manager",
};

export const FUEL_LABEL = {
  PETROL: "Petrol",
  DIESEL: "Diesel",
  CNG: "CNG",
  ELECTRIC: "Electric",
  HYBRID: "Hybrid",
} as const;

export const TRANSMISSION_LABEL = { MANUAL: "Manual", AUTOMATIC: "Automatic" } as const;

/** "2:41" for < 1 h, "1h 07m" beyond. Always non-negative. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Compact IST timestamp for dense staff tables: "7 Nov, 3:42 pm". */
export function formatStaffDateTime(iso: string | Date): string {
  return formatDateIST(iso, "en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
export function formatStaffDate(iso: string | Date): string {
  return formatDateIST(iso, "en");
}

/** "5 min ago" style, for the inbox list. */
export function timeAgo(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return formatStaffDate(iso);
}
