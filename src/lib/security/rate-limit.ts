/**
 * Fixed-window in-memory rate limiter.
 * Per server instance only — good enough to blunt form spam on a single Vercel function; a shared
 * store (e.g. Upstash) would be needed for a hard global limit.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Returns true if the call is allowed, false if `key` exceeded `limit` within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) sweep(now);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

function sweep(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}

/** Best-effort client IP (Vercel / proxies set x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
