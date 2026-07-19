import { z } from "zod";

import {
  contentRowBlockSchema,
  MAX_ROWS_PER_PROJECT,
} from "@/modules/layout/domain/blocks";
import {
  legacyRowBlockSchema,
  migrateLegacyRows,
} from "@/modules/layout/domain/legacy-blocks";
import {
  DEFAULT_PAGE_THEME,
  pageThemeSchema,
} from "@/modules/layout/domain/page-theme";

import { MAX_PROJECT_NAME_LENGTH } from "./project-name";

export const MAX_SUMMARY_LENGTH = 300;
export const MAX_PROJECTS = 100;

const projectIdSchema = z
  .string()
  .regex(/^project_[a-f0-9]{32}$/, { message: "Invalid project id" });

export const PROJECT_STATUSES = ["draft", "published", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Schema v3: rows carry rich-text blocks and the document has a page theme
 * (ADR-0002). `title`/`normalizedTitle`/`slug` stay absent for an untitled
 * draft and are set together whenever a title is present; the slug is always
 * derived from the current title (rule enforced by saveProject).
 *
 * A plain ZodObject (no .superRefine) so releaseProjectSchema can still
 * .omit()/.extend() it.
 */
export const projectDocumentSchema = z.object({
  schemaVersion: z.literal(3),
  id: projectIdSchema,
  title: z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH).optional(),
  normalizedTitle: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  summary: z.string().max(MAX_SUMMARY_LENGTH),
  theme: pageThemeSchema,
  rows: z.array(contentRowBlockSchema).max(MAX_ROWS_PER_PROJECT),
  revision: z.number().int().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

/** Schema-v2 drafts: plain text blocks, no theme. Read-only, never written. */
const projectDocumentV2Schema = z.object({
  schemaVersion: z.literal(2),
  id: projectIdSchema,
  title: z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH).optional(),
  normalizedTitle: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  summary: z.string().max(MAX_SUMMARY_LENGTH),
  rows: z.array(legacyRowBlockSchema).max(MAX_ROWS_PER_PROJECT),
  revision: z.number().int().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/**
 * Parses a stored draft of any supported schema version, normalizing old
 * versions to v3 in memory. R2 is never rewritten just because an old
 * document was read; the next save persists v3.
 */
export function parseProjectDocument(raw: unknown): ProjectDocument {
  const version = (raw as { schemaVersion?: unknown })?.schemaVersion;

  if (version === 2) {
    const v2 = projectDocumentV2Schema.parse(raw);
    const { rows, ...rest } = v2;
    return {
      ...rest,
      schemaVersion: 3,
      theme: DEFAULT_PAGE_THEME,
      rows: migrateLegacyRows(rows),
    };
  }

  return projectDocumentSchema.parse(raw);
}

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
  theme: pageThemeSchema,
  rows: z.array(contentRowBlockSchema).max(MAX_ROWS_PER_PROJECT),
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
