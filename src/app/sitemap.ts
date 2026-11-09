import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { sitemapEntries } from "@/server/queries/public";

// Rebuilt at most hourly so new stock and variants appear without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { models, used } = await sitemapEntries();
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/cars"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/used"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/test-drive"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/service"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/trade-in"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/opt-out"), changeFrequency: "yearly", priority: 0.2 },
  ].map((e) => ({ ...e, lastModified: now }) as MetadataRoute.Sitemap[number]);

  const modelPages: MetadataRoute.Sitemap = models.flatMap((m) => [
    { url: absoluteUrl(`/cars/${m.slug}`), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...m.variants.map(
      (v) =>
        ({
          url: absoluteUrl(`/cars/${m.slug}/${v.slug}`),
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.8,
        }) as const,
    ),
  ]);

  const usedPages: MetadataRoute.Sitemap = used.map((u) => ({
    url: absoluteUrl(`/used/${u.slug}`),
    lastModified: u.updatedAt,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticPages, ...modelPages, ...usedPages];
}
