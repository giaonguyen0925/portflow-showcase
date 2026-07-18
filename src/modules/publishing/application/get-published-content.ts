import type {
  ReleaseManifest,
  ReleaseProject,
  ReleaseSite,
} from "@/modules/publishing/domain/release";

import type { ReleaseRepository } from "./ports";

export type PublishedContent = {
  releaseId: string;
  site: ReleaseSite;
  manifest: ReleaseManifest;
};

export async function getPublishedContent(deps: {
  releases: ReleaseRepository;
}): Promise<PublishedContent | null> {
  const current = await deps.releases.readCurrent();
  if (!current) {
    return null;
  }

  const [site, manifest] = await Promise.all([
    deps.releases.readSite(current.releaseId),
    deps.releases.readManifest(current.releaseId),
  ]);

  if (!site || !manifest) {
    return null;
  }

  return { releaseId: current.releaseId, site, manifest };
}

export async function getPublishedProject(
  deps: { releases: ReleaseRepository },
  slug: string,
): Promise<ReleaseProject | null> {
  const current = await deps.releases.readCurrent();
  if (!current) {
    return null;
  }

  return deps.releases.readProject(current.releaseId, slug);
}
