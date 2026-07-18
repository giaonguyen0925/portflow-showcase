import { createAdminRoute, jsonResponse } from "@/lib/api/admin-route";
import { getR2ObjectStore } from "@/lib/r2/r2-object-store";
import { saveSite } from "@/modules/site/application/save-site";
import { createR2SiteRepository } from "@/modules/site/infrastructure/r2-site-repository";

export const PUT = createAdminRoute(
  "admin.site.save",
  async ({ request }) => {
    const body: unknown = await request.json();
    const site = await saveSite(
      { sites: createR2SiteRepository(getR2ObjectStore()) },
      body,
    );
    return jsonResponse({ site });
  },
  { rateLimit: { limit: 30, windowMs: 60_000 } },
);
