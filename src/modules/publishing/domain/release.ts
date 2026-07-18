import { z } from "zod";

import { projectDocumentSchema } from "@/modules/project/domain/project-document";
import { siteDocumentSchema } from "@/modules/site/domain/site-document";

const releaseIdSchema = z
  .string()
  .regex(/^release_[a-f0-9]{8,40}$|^release_[0-9]{14}[a-f0-9]{8}$/, {
    message: "Invalid release id",
  });

/** Card data the public home page needs, resolved at publish time. */
export const releaseProjectCardSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  coverUrl: z.url().optional(),
  coverWidth: z.number().int().min(1).optional(),
  coverHeight: z.number().int().min(1).optional(),
});

export type ReleaseProjectCard = z.infer<typeof releaseProjectCardSchema>;

export const releaseManifestSchema = z.object({
  schemaVersion: z.literal(1),
  releaseId: releaseIdSchema,
  createdAt: z.iso.datetime(),
  projects: z.array(releaseProjectCardSchema),
});

export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;

export const releaseSiteSchema = siteDocumentSchema.omit({ revision: true }).extend({
  avatarUrl: z.url().optional(),
});

export type ReleaseSite = z.infer<typeof releaseSiteSchema>;

/** Only projects with a title/slug are ever published, so both are required here. */
export const releaseProjectSchema = projectDocumentSchema
  .omit({ revision: true, normalizedTitle: true })
  .extend({
    title: z.string().min(1),
    slug: z.string().min(1),
  });

export type ReleaseProject = z.infer<typeof releaseProjectSchema>;

export const currentPointerSchema = z.object({
  schemaVersion: z.literal(1),
  releaseId: releaseIdSchema,
  publishedAt: z.iso.datetime(),
});

export type CurrentPointer = z.infer<typeof currentPointerSchema>;
