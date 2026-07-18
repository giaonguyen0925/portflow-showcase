import { AppError } from "@/lib/api/app-error";
import { createInitialProjectIndex } from "@/modules/project/domain/project-document";

import type { ProjectRepository } from "./ports";

/**
 * V1 never hard-deletes: the draft is copied to the archive prefix first,
 * then removed from the index. Unreferenced assets are cleaned up later by
 * the staging/retention lifecycle, not in this request.
 */
export async function archiveProject(
  deps: { projects: ProjectRepository },
  projectId: string,
): Promise<{ projectId: string; archivedAt: string }> {
  const current = await deps.projects.readDraft(projectId);

  if (!current) {
    throw new AppError("PROJECT_NOT_FOUND", "Project does not exist");
  }

  const archivedAt = new Date().toISOString();
  const timestamp = archivedAt.replaceAll(/[:.]/g, "-");

  await deps.projects.writeArchive(current, timestamp);

  const index =
    (await deps.projects.readIndex()) ?? createInitialProjectIndex();
  await deps.projects.writeIndex({
    ...index,
    revision: index.revision + 1,
    projects: index.projects.filter((p) => p.id !== projectId),
  });

  await deps.projects.deleteDraft(projectId);

  return { projectId, archivedAt };
}
