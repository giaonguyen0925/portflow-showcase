const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Guards every dynamic key segment against path traversal and key smuggling.
 * IDs and slugs are already strictly shaped; this is defense in depth.
 */
function safeSegment(value: string): string {
  if (!SAFE_SEGMENT.test(value) || value.includes("..")) {
    throw new Error(`Unsafe object key segment: ${JSON.stringify(value)}`);
  }
  return value;
}

export const privateKeys = {
  siteDraft: () => "content/site/draft.json",
  projectIndex: () => "content/projects/index.json",
  projectDraft: (projectId: string) =>
    `content/projects/${safeSegment(projectId)}/draft.json`,
  siteHistory: (revision: number) =>
    `content/history/site/${safeSegment(String(revision))}.json`,
  projectHistory: (projectId: string, revision: number) =>
    `content/history/projects/${safeSegment(projectId)}/${safeSegment(String(revision))}.json`,
  releaseManifest: (releaseId: string) =>
    `content/releases/${safeSegment(releaseId)}/manifest.json`,
  releaseSite: (releaseId: string) =>
    `content/releases/${safeSegment(releaseId)}/site.json`,
  releaseProject: (releaseId: string, projectSlug: string) =>
    `content/releases/${safeSegment(releaseId)}/projects/${safeSegment(projectSlug)}.json`,
  currentPointer: () => "content/current.json",
  stagingUpload: (uploadId: string) =>
    `uploads/staging/${safeSegment(uploadId)}`,
  archivedProject: (projectId: string, timestamp: string) =>
    `archive/projects/${safeSegment(projectId)}/${safeSegment(timestamp)}.json`,
} as const;

const ASSET_EXTENSION = /^(webp|mp4|webm)$/;

export const publicKeys = {
  assetOriginal: (assetId: string, extension: string = "webp") => {
    if (!ASSET_EXTENSION.test(extension)) {
      throw new Error(`Unsafe asset extension: ${JSON.stringify(extension)}`);
    }
    return `assets/${safeSegment(assetId)}/original.${extension}`;
  },
} as const;
