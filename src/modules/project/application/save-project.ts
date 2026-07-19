import { AppError } from "@/lib/api/app-error";
import type { Asset } from "@/modules/asset/domain/asset";
import {
  collectMediaAssets,
  firstImageBlock,
  MAX_MEDIA_BLOCKS_PER_PROJECT,
} from "@/modules/layout/domain/blocks";
import {
  createInitialProjectIndex,
  saveProjectInputSchema,
  type ProjectDocument,
} from "@/modules/project/domain/project-document";
import { normalizeProjectName } from "@/modules/project/domain/project-name";
import { generateSlugFromName, isValidSlug } from "@/modules/project/domain/slug";

import type { ProjectRepository } from "./ports";

export function assertAssetsBelongToPublicBase(
  assets: Asset[],
  assetBaseUrl: string,
): void {
  const base = `${assetBaseUrl.replace(/\/$/, "")}/`;
  for (const asset of assets) {
    if (!asset.url.startsWith(base) || !asset.url.endsWith(asset.key)) {
      throw new AppError(
        "INVALID_ASSET",
        "Asset URL does not belong to the public asset domain",
        { assetId: asset.id },
      );
    }
  }
}

export async function saveProject(
  deps: { projects: ProjectRepository; assetBaseUrl: string },
  projectId: string,
  input: unknown,
): Promise<ProjectDocument> {
  const parsed = saveProjectInputSchema.parse(input);
  const current = await deps.projects.readDraft(projectId);

  if (!current) {
    throw new AppError("PROJECT_NOT_FOUND", "Project does not exist");
  }

  if (current.revision !== parsed.expectedRevision) {
    throw new AppError(
      "REVISION_CONFLICT",
      "The project was changed elsewhere. Reload and try again.",
      { currentRevision: current.revision },
    );
  }

  const mediaAssets = collectMediaAssets(parsed.rows);
  if (mediaAssets.length > MAX_MEDIA_BLOCKS_PER_PROJECT) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Too many media blocks in this project (max ${MAX_MEDIA_BLOCKS_PER_PROJECT})`,
    );
  }
  assertAssetsBelongToPublicBase(mediaAssets, deps.assetBaseUrl);

  const index =
    (await deps.projects.readIndex()) ?? createInitialProjectIndex();
  const entry = index.projects.find((p) => p.id === projectId);

  if (!entry) {
    throw new AppError("PROJECT_NOT_FOUND", "Project is not in the index");
  }

  const trimmedTitle = parsed.title.trim();

  // title/normalizedTitle/slug: absent while untitled; set together whenever
  // a title is present. Slug is always derived from the current title
  // (lowercase, spaces → "-", Vietnamese diacritics stripped). Once a
  // project has a public URL, the title can no longer be cleared.
  let titleFields: Pick<ProjectDocument, "title" | "normalizedTitle" | "slug"> =
    {};

  if (trimmedTitle.length === 0) {
    if (current.slug !== undefined) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Title cannot be cleared once the project has a public URL",
      );
    }
  } else {
    const normalizedTitle = normalizeProjectName(trimmedTitle);
    if (
      index.projects.some(
        (p) => p.id !== projectId && p.normalizedTitle === normalizedTitle,
      )
    ) {
      throw new AppError(
        "PROJECT_NAME_CONFLICT",
        "A project with this name already exists",
        { normalizedTitle },
      );
    }
    const slug = generateSlugFromName(trimmedTitle);
    if (
      !isValidSlug(slug) ||
      index.projects.some((p) => p.id !== projectId && p.slug === slug)
    ) {
      throw new AppError(
        "PROJECT_SLUG_CONFLICT",
        "This title produces a URL that is already taken",
        { slug },
      );
    }
    titleFields = { title: trimmedTitle, normalizedTitle, slug };
  }

  await deps.projects.writeHistory(current);

  const now = new Date().toISOString();
  const next: ProjectDocument = {
    ...current,
    ...titleFields,
    summary: parsed.summary,
    theme: parsed.theme,
    rows: parsed.rows,
    revision: current.revision + 1,
    updatedAt: now,
  };

  await deps.projects.writeDraft(next);

  const cover = firstImageBlock(parsed.rows);
  const coverPatch =
    cover === undefined
      ? ({ coverAssetId: undefined } as const)
      : ({ coverAssetId: cover.asset.id } as const);

  // Index writes are last-writer-wins and race with other autosaves/publish.
  // Retry against a fresh read so this project's title/slug are not lost.
  let wrote = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const latestIndex =
      (await deps.projects.readIndex()) ?? createInitialProjectIndex();
    if (!latestIndex.projects.some((p) => p.id === projectId)) {
      throw new AppError("PROJECT_NOT_FOUND", "Project is not in the index");
    }

    const baseRevision = latestIndex.revision;
    await deps.projects.writeIndex({
      ...latestIndex,
      revision: baseRevision + 1,
      projects: latestIndex.projects.map((p) => {
        if (p.id !== projectId) {
          return p;
        }
        const merged: typeof p = {
          ...p,
          ...titleFields,
          summary: next.summary,
          updatedAt: now,
        };
        if (coverPatch.coverAssetId === undefined) {
          delete (merged as { coverAssetId?: string }).coverAssetId;
        } else {
          merged.coverAssetId = coverPatch.coverAssetId;
        }
        return merged;
      }),
    });

    const verify = await deps.projects.readIndex();
    const entry = verify?.projects.find((p) => p.id === projectId);
    const slugOk =
      titleFields.slug === undefined || entry?.slug === titleFields.slug;
    const titleOk =
      titleFields.title === undefined || entry?.title === titleFields.title;
    if (entry && slugOk && titleOk) {
      wrote = true;
      break;
    }
  }

  if (!wrote) {
    throw new AppError(
      "REVISION_CONFLICT",
      "Could not update the project index. Reload and try again.",
    );
  }

  return next;
}
