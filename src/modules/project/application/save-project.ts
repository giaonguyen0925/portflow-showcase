import { AppError } from "@/lib/api/app-error";
import type { Asset } from "@/modules/asset/domain/asset";
import {
  collectImageAssets,
  firstImageBlock,
  MAX_IMAGE_BLOCKS_PER_PROJECT,
} from "@/modules/project/domain/blocks";
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

  const imageAssets = collectImageAssets(parsed.rows);
  if (imageAssets.length > MAX_IMAGE_BLOCKS_PER_PROJECT) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Too many images in this project (max ${MAX_IMAGE_BLOCKS_PER_PROJECT})`,
    );
  }
  assertAssetsBelongToPublicBase(imageAssets, deps.assetBaseUrl);

  const index =
    (await deps.projects.readIndex()) ?? createInitialProjectIndex();
  const entry = index.projects.find((p) => p.id === projectId);

  if (!entry) {
    throw new AppError("PROJECT_NOT_FOUND", "Project is not in the index");
  }

  const trimmedTitle = parsed.title.trim();

  // title/normalizedTitle/slug: absent while the project stays untitled; set
  // together the first time a title is entered; the slug never regenerates
  // after that (ARD §7.2 — stable slug), and title can no longer be cleared
  // back to empty once the project has a public URL.
  let titleFields: Pick<ProjectDocument, "title" | "normalizedTitle" | "slug"> =
    {};

  if (current.slug !== undefined) {
    if (trimmedTitle.length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Title cannot be cleared once the project has a public URL",
      );
    }
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
    titleFields = { title: trimmedTitle, normalizedTitle, slug: current.slug };
  } else if (trimmedTitle.length > 0) {
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
    if (!isValidSlug(slug) || index.projects.some((p) => p.slug === slug)) {
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
    rows: parsed.rows,
    revision: current.revision + 1,
    updatedAt: now,
  };

  await deps.projects.writeDraft(next);

  const cover = firstImageBlock(parsed.rows);
  await deps.projects.writeIndex({
    ...index,
    revision: index.revision + 1,
    projects: index.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            ...titleFields,
            summary: next.summary,
            ...(cover === undefined
              ? { coverAssetId: undefined }
              : { coverAssetId: cover.asset.id }),
            updatedAt: now,
          }
        : p,
    ),
  });

  return next;
}
