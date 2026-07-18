import { privateKeys } from "@/lib/r2/keys";
import type { ObjectStore } from "@/lib/r2/object-store";
import type { ProjectRepository } from "@/modules/project/application/ports";
import {
  projectDocumentSchema,
  projectIndexDocumentSchema,
  type ProjectDocument,
  type ProjectIndexDocument,
} from "@/modules/project/domain/project-document";

export function createR2ProjectRepository(
  store: ObjectStore,
): ProjectRepository {
  return {
    async readIndex(): Promise<ProjectIndexDocument | null> {
      const raw = await store.getJson("private", privateKeys.projectIndex());
      return raw === null ? null : projectIndexDocumentSchema.parse(raw);
    },

    async writeIndex(document: ProjectIndexDocument): Promise<void> {
      await store.putJson("private", privateKeys.projectIndex(), document, {
        cacheControl: "no-store",
      });
    },

    async readDraft(projectId: string): Promise<ProjectDocument | null> {
      const raw = await store.getJson(
        "private",
        privateKeys.projectDraft(projectId),
      );
      return raw === null ? null : projectDocumentSchema.parse(raw);
    },

    async writeDraft(document: ProjectDocument): Promise<void> {
      await store.putJson(
        "private",
        privateKeys.projectDraft(document.id),
        document,
        { cacheControl: "no-store" },
      );
    },

    async writeHistory(document: ProjectDocument): Promise<void> {
      await store.putJson(
        "private",
        privateKeys.projectHistory(document.id, document.revision),
        document,
        { cacheControl: "no-store" },
      );
    },

    async writeArchive(
      document: ProjectDocument,
      timestamp: string,
    ): Promise<void> {
      await store.putJson(
        "private",
        privateKeys.archivedProject(document.id, timestamp),
        document,
        { cacheControl: "no-store" },
      );
    },

    async deleteDraft(projectId: string): Promise<void> {
      await store.delete("private", privateKeys.projectDraft(projectId));
    },
  };
}
