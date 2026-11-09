import { PrismaClient } from "@prisma/client";

/**
 * Serverless Postgres (Neon) suspends when idle and can take a few seconds to wake; Prisma's
 * default 5 s connect timeout then fails builds and cold requests with P1001. Give connections
 * more time unless the URL already sets its own values.
 */
export function withConnectionTimeouts(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "30");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "30");
    return u.toString();
  } catch {
    return url; // not a URL we can parse — leave it to Prisma to report
  }
}

// Single Prisma client per process (avoids exhausting connections during dev hot-reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = withConnectionTimeouts(process.env.DATABASE_URL);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
