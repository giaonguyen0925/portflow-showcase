import { createProjectId } from "@/lib/ids/ids";
import { AppError } from "@/lib/api/app-error";
import {
  createInitialProjectIndex,
  MAX_PROJECTS,
  nextProjectOrder,
  type ProjectDocument,
  type ProjectIndexEntry,
} from "@/modules/project/domain/project-document";

import type { ProjectRepository } from "./ports";

export function toIndexEntry(
  project: ProjectDocument,
  order: number,
): ProjectIndexEntry {
  return {
    id: project.id,
    ...(project.title === undefined ? {} : { title: project.title }),
    ...(project.normalizedTitle === undefined
      ? {}
      : { normalizedTitle: project.normalizedTitle }),
    ...(project.slug === undefined ? {} : { slug: project.slug }),
    summary: project.summary,
    order,
    isVisible: true,
    status: "draft",
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/**
 * Creates an empty draft: no title, no slug, no rows. The admin lands
 * directly on the canvas (ADR-0001) and only picks a title (which then
 * generates the slug once) when they're ready.
 */
export async function createProject(deps: {
  projects: ProjectRepository;
}): Promise<ProjectDocument> {
  const index =
    (await deps.projects.readIndex()) ?? createInitialProjectIndex();

  if (index.projects.length >= MAX_PROJECTS) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Project limit of ${MAX_PROJECTS} reached`,
    );
  }

  const now = new Date().toISOString();
  const project: ProjectDocument = {
    schemaVersion: 2,
    id: createProjectId(),
    summary: "",
    rows: [],
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };

  await deps.projects.writeDraft(project);
  await deps.projects.writeIndex({
    ...index,
    revision: index.revision + 1,
    projects: [...index.projects, toIndexEntry(project, nextProjectOrder(index))],
  });

  return project;
}
