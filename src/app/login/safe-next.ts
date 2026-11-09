import type { Role } from "@/types/contracts";

/** Only same-site relative paths ("/inbox/abc"), never "//evil.com" or "/\evil.com". */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || next.length > 300) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/login") || next.startsWith("/api/")) return null;
  return next;
}

export function homeForRole(role: Role): string {
  switch (role) {
    case "CONSULTANT":
      return "/inbox";
    case "ADMIN":
      return "/admin";
    case "USED_CAR_MANAGER":
      return "/admin/used-cars";
    default:
      return "/";
  }
}

/** Mirrors middleware rules so we don't bounce a user to a page they can't open. */
export function canOpen(role: Role, path: string): boolean {
  if (path === "/inbox" || path.startsWith("/inbox/")) return role === "CONSULTANT" || role === "ADMIN";
  if (path === "/admin/used-cars" || path.startsWith("/admin/used-cars/"))
    return role === "ADMIN" || role === "USED_CAR_MANAGER";
  if (path === "/admin" || path.startsWith("/admin/")) return role === "ADMIN";
  return true;
}

export function destinationFor(role: Role, next: unknown): string {
  const n = safeNext(next);
  return n && canOpen(role, n) ? n : homeForRole(role);
}
