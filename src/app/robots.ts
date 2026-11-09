import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/inbox", "/admin", "/api", "/login", "/forbidden", "/test-drive/confirmed"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
