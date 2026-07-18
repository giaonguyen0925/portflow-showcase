import type {
  ProjectDocument,
  ProjectIndexDocument,
} from "@/modules/project/domain/project-document";

export interface ProjectRepository {
  readIndex(): Promise<ProjectIndexDocument | null>;
  writeIndex(document: ProjectIndexDocument): Promise<void>;
  readDraft(projectId: string): Promise<ProjectDocument | null>;
  writeDraft(document: ProjectDocument): Promise<void>;
  writeHistory(document: ProjectDocument): Promise<void>;
  writeArchive(document: ProjectDocument, timestamp: string): Promise<void>;
  deleteDraft(projectId: string): Promise<void>;
}
