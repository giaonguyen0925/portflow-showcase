import type { MetadataRoute } from "next";

import { getPublicAppUrl } from "@/lib/env/public";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicAppUrl();

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
