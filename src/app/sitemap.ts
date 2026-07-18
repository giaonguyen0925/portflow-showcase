import type { MetadataRoute } from "next";

import { getPublicAppUrl } from "@/lib/env/public";
import { loadPublishedContent } from "@/modules/publishing/infrastructure/published-content-source";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicAppUrl();
  const root = { url: base, lastModified: new Date() };

  try {
    const published = await loadPublishedContent();
    if (!published) {
      return [root];
    }

    return [
      { url: base, lastModified: new Date(published.manifest.createdAt) },
      ...published.manifest.projects.map((project) => ({
        url: `${base}/${project.slug}`,
        lastModified: new Date(published.manifest.createdAt),
      })),
    ];
  } catch {
    // Storage hiccups should not turn the sitemap into a hard error.
    return [root];
  }
}
