import { AppError } from "@/lib/api/app-error";
import { createReleaseId } from "@/lib/ids/ids";
import { logServerEvent } from "@/lib/observability/logger";
import { publicAssetUrl } from "@/modules/asset/domain/asset";
import { assertAssetsBelongToPublicBase } from "@/modules/project/application/save-project";
import type { ProjectRepository } from "@/modules/project/application/ports";
import { collectImageAssets, firstImageBlock } from "@/modules/project/domain/blocks";
import {
  createInitialProjectIndex,
  projectDocumentSchema,
  type ProjectDocument,
  type ProjectIndexEntry,
} from "@/modules/project/domain/project-document";
import type { SiteRepository } from "@/modules/site/application/ports";
import {
  createInitialSiteDocument,
  siteDocumentSchema,
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
 * Untitled drafts (no slug yet) are silently skipped — they simply aren't
 * ready to publish. Projects with `isVisible: false` still get their own
 * `/{slug}` release page written, but are left out of the home manifest.
 */
export async function publishRelease(deps: {
  sites: SiteRepository;
  projects: ProjectRepository;
  releases: ReleaseRepository;
  assetBaseUrl: string;
}): Promise<PublishResult> {
  const site = siteDocumentSchema.parse(
    (await deps.sites.readDraft()) ?? createInitialSiteDocument(),
  );
  const index =
    (await deps.projects.readIndex()) ?? createInitialProjectIndex();

  const publishableEntries = index.projects.filter(
    (p): p is ProjectIndexEntry & { slug: string } =>
      p.status !== "archived" && p.slug !== undefined,
  );

  const pairs: Array<{ entry: ProjectIndexEntry; document: TitledProjectDocument }> =
    [];
  for (const entry of publishableEntries) {
    const draft = await deps.projects.readDraft(entry.id);
    if (!draft) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Project index references a missing draft",
        { projectId: entry.id },
      );
    }
    const parsed = projectDocumentSchema.parse(draft);
    if (!isTitled(parsed)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Project index has a slug but the draft has none",
        { projectId: entry.id },
      );
    }
    assertAssetsBelongToPublicBase(collectImageAssets(parsed.rows), deps.assetBaseUrl);
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

  // Best-effort bookkeeping: the release is already live. Only entries
  // actually included in this release flip to "published"; untitled drafts
  // and archived entries are untouched.
  try {
    const publishedIds = new Set(pairs.map(({ entry }) => entry.id));
    await deps.projects.writeIndex({
      ...index,
      revision: index.revision + 1,
      projects: index.projects.map((p) =>
        publishedIds.has(p.id) ? { ...p, status: "published" } : p,
      ),
    });
  } catch {
    logServerEvent("warn", "publish.index-status-update-failed", {
      releaseId,
    });
  }

  return { releaseId, publishedAt, projectCount: pairs.length };
}
