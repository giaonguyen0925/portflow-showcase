import { AppError } from "@/lib/api/app-error";
import {
  createInitialProjectIndex,
  reorderProjectsInputSchema,
  type ProjectIndexDocument,
} from "@/modules/project/domain/project-document";

import type { ProjectRepository } from "./ports";

/**
 * Applies new `order`/`isVisible` values from the portfolio organizer. Pure
 * index bookkeeping — never touches a project's own draft document.
 */
export async function reorderProjects(
  deps: { projects: ProjectRepository },
  input: unknown,
): Promise<ProjectIndexDocument> {
  const parsed = reorderProjectsInputSchema.parse(input);
  const index =
    (await deps.projects.readIndex()) ?? createInitialProjectIndex();

  if (index.revision !== parsed.expectedIndexRevision) {
    throw new AppError(
      "REVISION_CONFLICT",
      "Portfolio order changed elsewhere. Reload and try again.",
      { currentRevision: index.revision },
    );
  }

  const desiredById = new Map(parsed.projects.map((p) => [p.id, p]));
  const coversEveryProject =
    desiredById.size === index.projects.length &&
    index.projects.every((p) => desiredById.has(p.id));

  if (!coversEveryProject) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Reorder payload must include every existing project exactly once",
    );
  }

  const next: ProjectIndexDocument = {
    ...index,
    revision: index.revision + 1,
    projects: index.projects.map((p) => {
      const desired = desiredById.get(p.id);
      return desired
        ? { ...p, order: desired.order, isVisible: desired.isVisible }
        : p;
    }),
  };

  await deps.projects.writeIndex(next);
  return next;
}
