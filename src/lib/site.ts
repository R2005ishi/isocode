/**
 * Absolute base URL for metadata, sitemap and JSON-LD.
 * Order: NEXT_PUBLIC_SITE_URL → Vercel's production domain (set automatically on Vercel) → localhost.
 */
export function siteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || (vercel ? `https://${vercel}` : "") || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
