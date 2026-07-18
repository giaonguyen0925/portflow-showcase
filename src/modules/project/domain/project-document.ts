import { z } from "zod";

import { MAX_ROWS_PER_PROJECT, rowBlockSchema } from "./blocks";
import { MAX_PROJECT_NAME_LENGTH } from "./project-name";

export const MAX_SUMMARY_LENGTH = 300;
export const MAX_PROJECTS = 100;

const projectIdSchema = z
  .string()
  .regex(/^project_[a-f0-9]{32}$/, { message: "Invalid project id" });

export const PROJECT_STATUSES = ["draft", "published", "archived"] as const;

/**
 * `title`/`normalizedTitle`/`slug` are absent for a fresh, still-untitled
 * draft (ADR-0001 §"Luồng tạo project mới") and are all set together the
 * first time an admin gives the project a title; the slug never changes
 * after that.
 */
// A plain ZodObject (no .superRefine) so releaseProjectSchema can still
// .omit()/.extend() it below. The "title and slug are set together" rule is
// enforced by saveProject() — the only code path that writes this document.
export const projectDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  id: projectIdSchema,
  title: z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH).optional(),
  normalizedTitle: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  summary: z.string().max(MAX_SUMMARY_LENGTH),
  rows: z.array(rowBlockSchema).max(MAX_ROWS_PER_PROJECT),
  revision: z.number().int().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

export const projectIndexEntrySchema = z.object({
  id: projectIdSchema,
  title: z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH).optional(),
  normalizedTitle: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  summary: z.string().max(MAX_SUMMARY_LENGTH),
  coverAssetId: z
    .string()
    .regex(/^asset_[a-f0-9]{32}$/)
    .optional(),
  /** Portfolio display order; lower sorts first. Not necessarily contiguous. */
  order: z.number().int(),
  isVisible: z.boolean(),
  status: z.enum(PROJECT_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ProjectIndexEntry = z.infer<typeof projectIndexEntrySchema>;

export const projectIndexDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  revision: z.number().int().min(0),
  projects: z.array(projectIndexEntrySchema).max(MAX_PROJECTS),
});

export type ProjectIndexDocument = z.infer<typeof projectIndexDocumentSchema>;

export function createInitialProjectIndex(): ProjectIndexDocument {
  return {
    schemaVersion: 2,
    revision: 0,
    projects: [],
  };
}

export function nextProjectOrder(index: ProjectIndexDocument): number {
  return index.projects.reduce((max, p) => Math.max(max, p.order), 0) + 1;
}

/** Editable fields when saving a project; slug and ids are system-managed. */
export const saveProjectInputSchema = z.object({
  title: z.string().trim().max(MAX_PROJECT_NAME_LENGTH),
  summary: z.string().max(MAX_SUMMARY_LENGTH),
  rows: z.array(rowBlockSchema).max(MAX_ROWS_PER_PROJECT),
  expectedRevision: z.number().int().min(1),
});

export type SaveProjectInput = z.infer<typeof saveProjectInputSchema>;

/** Desired order/visibility for one project, used by the portfolio organizer. */
export const projectOrderEntrySchema = z.object({
  id: projectIdSchema,
  order: z.number().int(),
  isVisible: z.boolean(),
});

export const reorderProjectsInputSchema = z.object({
  projects: z.array(projectOrderEntrySchema).max(MAX_PROJECTS),
  expectedIndexRevision: z.number().int().min(0),
});

export type ReorderProjectsInput = z.infer<typeof reorderProjectsInputSchema>;
