import { AppError } from "@/lib/api/app-error";
import { createReleaseId } from "@/lib/ids/ids";
import { logServerEvent } from "@/lib/observability/logger";
import { publicAssetUrl } from "@/modules/asset/domain/asset";
import { assertAssetsBelongToPublicBase } from "@/modules/project/application/save-project";
import type { ProjectRepository } from "@/modules/project/application/ports";
import { collectMediaAssets, firstImageBlock } from "@/modules/layout/domain/blocks";
import {
  createInitialProjectIndex,
  parseProjectDocument,
  type ProjectDocument,
  type ProjectIndexEntry,
} from "@/modules/project/domain/project-document";
import type { SiteRepository } from "@/modules/site/application/ports";
import {
  createInitialSiteDocument,
  parseSiteDocument,
  validateSiteLayout,
} from "@/modules/site/domain/site-document";
import type {
  ReleaseManifest,
  ReleaseProjectCard,
  ReleaseSite,
} from "@/modules/publishing/domain/release";

import type { ReleaseRepository } from "./ports";

export type PublishResult = {
  releaseId: string;
  publishedAt: string;
  projectCount: number;
};

/** A titled project document, ready to publish (slug/title narrowed to required). */
type TitledProjectDocument = ProjectDocument & { title: string; slug: string };

function isTitled(project: ProjectDocument): project is TitledProjectDocument {
  return project.title !== undefined && project.slug !== undefined;
}

function toCard(project: TitledProjectDocument): ReleaseProjectCard {
  const cover = firstImageBlock(project.rows);

  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    ...(cover === undefined
      ? {}
      : {
          coverUrl: cover.asset.url,
          coverWidth: cover.asset.width,
          coverHeight: cover.asset.height,
        }),
  };
}

/**
 * Builds an immutable release snapshot and only flips `content/current.json`
 * once every snapshot object has been written. Any failure before that final
 * write leaves the previous release fully intact (ARD §6.7).
 *
 * Untitled drafts (no title/slug on the draft document) are silently skipped.
 * The draft is the source of truth — index.slug can lag after concurrent
 * saves, so we never require the index entry to already carry a slug.
 * Projects with `isVisible: false` still get their own `/{slug}` release
 * page written, but are left out of the home manifest.
 */
export async function publishRelease(deps: {
  sites: SiteRepository;
  projects: ProjectRepository;
  releases: ReleaseRepository;
  assetBaseUrl: string;
}): Promise<PublishResult> {
  const site = parseSiteDocument(
    (await deps.sites.readDraft()) ?? createInitialSiteDocument(),
  );

  const layoutProblem = validateSiteLayout(site.rows);
  if (layoutProblem) {
    throw new AppError("VALIDATION_ERROR", layoutProblem);
  }

  const index =
    (await deps.projects.readIndex()) ?? createInitialProjectIndex();

  const candidates = index.projects.filter((p) => p.status !== "archived");

  const pairs: Array<{ entry: ProjectIndexEntry; document: TitledProjectDocument }> =
    [];
  for (const entry of candidates) {
    const draft = await deps.projects.readDraft(entry.id);
    if (!draft) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Project index references a missing draft",
        { projectId: entry.id },
      );
    }
    const parsed = parseProjectDocument(draft);
    if (!isTitled(parsed)) {
      // Untitled canvas drafts are not ready for a public URL yet.
      continue;
    }
    assertAssetsBelongToPublicBase(collectMediaAssets(parsed.rows), deps.assetBaseUrl);
    pairs.push({ entry, document: parsed });
  }

  pairs.sort((a, b) => a.entry.order - b.entry.order);

  const normalizedTitles = new Set<string>();
  const slugs = new Set<string>();
  for (const { document } of pairs) {
    const normalizedTitle = document.normalizedTitle ?? document.title;
    if (normalizedTitles.has(normalizedTitle)) {
      throw new AppError("PROJECT_NAME_CONFLICT", "Duplicate project title", {
        normalizedTitle,
      });
    }
    if (slugs.has(document.slug)) {
      throw new AppError("PROJECT_SLUG_CONFLICT", "Duplicate project slug", {
        slug: document.slug,
      });
    }
    normalizedTitles.add(normalizedTitle);
    slugs.add(document.slug);
  }

  const releaseId = createReleaseId();
  const publishedAt = new Date().toISOString();

  for (const { document } of pairs) {
    await deps.releases.writeProject(releaseId, document.slug, {
      schemaVersion: document.schemaVersion,
      id: document.id,
      title: document.title,
      slug: document.slug,
      summary: document.summary,
      theme: document.theme,
      rows: document.rows,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  }

  const releaseSite: ReleaseSite = {
    schemaVersion: site.schemaVersion,
    title: site.title,
    bio: site.bio,
    font: site.font,
    socialLinks: site.socialLinks,
    theme: site.theme,
    rows: site.rows,
    updatedAt: site.updatedAt,
    ...(site.avatarAssetId === undefined
      ? {}
      : {
          avatarAssetId: site.avatarAssetId,
          avatarUrl: publicAssetUrl(deps.assetBaseUrl, site.avatarAssetId),
        }),
  };
  await deps.releases.writeSite(releaseId, releaseSite);

  const manifest: ReleaseManifest = {
    schemaVersion: 1,
    releaseId,
    createdAt: publishedAt,
    projects: pairs
      .filter(({ entry }) => entry.isVisible)
      .map(({ document }) => toCard(document)),
  };
  await deps.releases.writeManifest(manifest);

  // The pointer flip is the commit point. Everything above is invisible to
  // the public site until this succeeds.
  await deps.releases.writeCurrent({
    schemaVersion: 1,
    releaseId,
    publishedAt,
  });

  // Best-effort: mark included projects published and repair index title/slug
  // from the draft (index.slug can lag after concurrent autosaves).
  const publishedById = new Map(
    pairs.map(({ entry, document }) => [entry.id, document] as const),
  );
  try {
    await syncPublishedIndexEntries(deps.projects, publishedById);
  } catch {
    logServerEvent("warn", "publish.index-status-update-failed", {
      releaseId,
    });
  }

  return { releaseId, publishedAt, projectCount: pairs.length };
}

const INDEX_STATUS_ATTEMPTS = 3;

async function syncPublishedIndexEntries(
  projects: ProjectRepository,
  publishedById: Map<string, TitledProjectDocument>,
): Promise<void> {
  if (publishedById.size === 0) {
    return;
  }

  for (let attempt = 0; attempt < INDEX_STATUS_ATTEMPTS; attempt += 1) {
    const latest =
      (await projects.readIndex()) ?? createInitialProjectIndex();
    await projects.writeIndex({
      ...latest,
      revision: latest.revision + 1,
      projects: latest.projects.map((p) => {
        const document = publishedById.get(p.id);
        if (!document) {
          return p;
        }
        return {
          ...p,
          title: document.title,
          ...(document.normalizedTitle === undefined
            ? {}
            : { normalizedTitle: document.normalizedTitle }),
          slug: document.slug,
          summary: document.summary,
          status: "published" as const,
        };
      }),
    });

    const verify = await projects.readIndex();
    const allMarked = [...publishedById.keys()].every((id) => {
      const entry = verify?.projects.find((p) => p.id === id);
      return (
        entry?.status === "published" &&
        entry.slug === publishedById.get(id)?.slug
      );
    });
    if (allMarked) {
      return;
    }
  }

  throw new Error("Could not persist published status on the project index");
}
