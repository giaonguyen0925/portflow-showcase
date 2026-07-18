import type { ProjectDocument, ProjectIndexDocument } from "@/modules/project/domain/project-document";
import type { CurrentPointer } from "@/modules/publishing/domain/release";
import type { SiteDocument } from "@/modules/site/domain/site-document";

/** Response shapes shared between the admin API routes and the admin UI. */

export type AdminContentResponse = {
  site: SiteDocument;
  avatarUrl: string | null;
  projectIndex: ProjectIndexDocument;
  /** projectId -> public cover image URL, for projects with a coverAssetId. */
  projectCoverUrls: Record<string, string>;
  currentRelease: CurrentPointer | null;
};

export type SaveSiteResponse = { site: SiteDocument };

export type ProjectResponse = { project: ProjectDocument };

export type PublishResponse = {
  releaseId: string;
  publishedAt: string;
  projectCount: number;
  publicUrl: string;
};
