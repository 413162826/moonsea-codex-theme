import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { THEMES } from "../lib/theme-catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL.toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/themes", SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...THEMES.map((theme) => ({
      url: new URL(`/themes/${theme.id}`, SITE_URL).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
