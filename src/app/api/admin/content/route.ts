import { createAdminRoute, jsonResponse } from "@/lib/api/admin-route";
import type { AdminContentResponse } from "@/lib/api/contracts";
import { getServerEnv } from "@/lib/env/server";
import { getR2ObjectStore } from "@/lib/r2/r2-object-store";
import { publicAssetUrl } from "@/modules/asset/domain/asset";
import { createInitialProjectIndex } from "@/modules/project/domain/project-document";
import { createR2ProjectRepository } from "@/modules/project/infrastructure/r2-project-repository";
import { createR2ReleaseRepository } from "@/modules/publishing/infrastructure/r2-release-repository";
import { createInitialSiteDocument } from "@/modules/site/domain/site-document";
import { createR2SiteRepository } from "@/modules/site/infrastructure/r2-site-repository";

export const GET = createAdminRoute(
  "admin.content.read",
  async () => {
    const store = getR2ObjectStore();
    const [siteDraft, index, currentRelease] = await Promise.all([
      createR2SiteRepository(store).readDraft(),
      createR2ProjectRepository(store).readIndex(),
      createR2ReleaseRepository(store).readCurrent(),
    ]);

    const site = siteDraft ?? createInitialSiteDocument();
    const projectIndex = index ?? createInitialProjectIndex();
    const assetBaseUrl = getServerEnv().R2_PUBLIC_BASE_URL;

    const projectCoverUrls: Record<string, string> = {};
    for (const project of projectIndex.projects) {
      if (project.coverAssetId !== undefined) {
        projectCoverUrls[project.id] = publicAssetUrl(
          assetBaseUrl,
          project.coverAssetId,
        );
      }
    }

    const body: AdminContentResponse = {
      site,
      avatarUrl:
        site.avatarAssetId === undefined
          ? null
          : publicAssetUrl(assetBaseUrl, site.avatarAssetId),
      projectIndex,
      projectCoverUrls,
      currentRelease,
    };

    return jsonResponse(body);
  },
  { rateLimit: { limit: 120, windowMs: 60_000 } },
);
