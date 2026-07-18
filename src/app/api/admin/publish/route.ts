import { revalidatePath } from "next/cache";

import { createAdminRoute, jsonResponse } from "@/lib/api/admin-route";
import { getPublicAppUrl } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { getR2ObjectStore } from "@/lib/r2/r2-object-store";
import { createR2ProjectRepository } from "@/modules/project/infrastructure/r2-project-repository";
import { publishRelease } from "@/modules/publishing/application/publish-release";
import { createR2ReleaseRepository } from "@/modules/publishing/infrastructure/r2-release-repository";
import { createR2SiteRepository } from "@/modules/site/infrastructure/r2-site-repository";

export const POST = createAdminRoute(
  "admin.publish",
  async () => {
    const store = getR2ObjectStore();
    const result = await publishRelease({
      sites: createR2SiteRepository(store),
      projects: createR2ProjectRepository(store),
      releases: createR2ReleaseRepository(store),
      assetBaseUrl: getServerEnv().R2_PUBLIC_BASE_URL,
    });

    // Root layout revalidation covers `/`, every `/{projectSlug}` (old and
    // new), and the sitemap.
    revalidatePath("/", "layout");

    return jsonResponse({
      releaseId: result.releaseId,
      publishedAt: result.publishedAt,
      projectCount: result.projectCount,
      publicUrl: getPublicAppUrl(),
    });
  },
  { rateLimit: { limit: 5, windowMs: 60_000 } },
);
