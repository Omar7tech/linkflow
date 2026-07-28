import type { MetadataRoute } from "next";
import { SITE } from "@/constants/site";
import { TOOLS } from "@/constants/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...TOOLS.map((tool) => ({
      url: `${SITE.url}${tool.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: `${SITE.url}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE.url}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE.url}/icons`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE.url}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}
