import { z } from "zod";

import {
  imageAssetSchema,
  videoAssetSchema,
  type Asset,
} from "@/modules/asset/domain/asset";
import { imageCropSchema } from "@/modules/layout/domain/image-crop";
import { richTextDocumentSchema } from "@/modules/rich-text/domain/rich-text-document";

export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 3;
export const MAX_ROWS_PER_PROJECT = 200;
export const MAX_BLOCKS_PER_COLUMN = 20;
/** Reuses the ARD §18 "Asset/project: tối đa 100" limit, now counted across
 * every image/video block in the row tree instead of a flat assets array. */
export const MAX_IMAGE_BLOCKS_PER_PROJECT = 100;
export const MAX_MEDIA_BLOCKS_PER_PROJECT = MAX_IMAGE_BLOCKS_PER_PROJECT;

const rowIdSchema = z.string().regex(/^row_[a-f0-9]{32}$/, {
  message: "Invalid row id",
});
const columnIdSchema = z.string().regex(/^column_[a-f0-9]{32}$/, {
  message: "Invalid column id",
});
const blockIdSchema = z.string().regex(/^block_[a-f0-9]{32}$/, {
  message: "Invalid block id",
});

export const imageBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("image"),
  asset: imageAssetSchema,
  /** Focal cover crop; omitted means centered cover (ADR-0004). */
  crop: imageCropSchema.optional(),
});

export type ImageBlock = z.infer<typeof imageBlockSchema>;

export const videoBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("video"),
  asset: videoAssetSchema,
});

export type VideoBlock = z.infer<typeof videoBlockSchema>;

export const richTextBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("rich-text"),
  content: richTextDocumentSchema,
});

export type RichTextBlock = z.infer<typeof richTextBlockSchema>;

/**
 * Site-only system blocks (ADR-0002). Schemas live here with the other block
 * primitives, but project documents validate against `contentBlockSchema`,
 * which excludes them — only the site document accepts them.
 */

export const profileBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("profile"),
  align: z.enum(["left", "center"]),
  showAvatar: z.boolean(),
  showBio: z.boolean(),
  showSocialLinks: z.boolean(),
});

export type ProfileBlock = z.infer<typeof profileBlockSchema>;

export const projectGridBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("project-grid"),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  showCover: z.boolean(),
  showTitle: z.boolean(),
  showSummary: z.boolean(),
  gap: z.enum(["compact", "normal", "relaxed"]),
});

export type ProjectGridBlock = z.infer<typeof projectGridBlockSchema>;

export const SYSTEM_BLOCK_TYPES = new Set(["profile", "project-grid"]);

/** Blocks any document may contain. */
export const contentBlockSchema = z.discriminatedUnion("type", [
  imageBlockSchema,
  videoBlockSchema,
  richTextBlockSchema,
]);

export type ContentBlock = z.infer<typeof contentBlockSchema>;

/** Blocks the site (root page) document may contain. */
export const siteBlockSchema = z.discriminatedUnion("type", [
  imageBlockSchema,
  videoBlockSchema,
  richTextBlockSchema,
  profileBlockSchema,
  projectGridBlockSchema,
]);

export type SiteBlock = z.infer<typeof siteBlockSchema>;

/** Widest block union; the runtime UI operates on this. */
export type Block = SiteBlock;

export type ColumnBlock = {
  id: string;
  blocks: Block[];
};

export type RowBlock = {
  id: string;
  type: "row";
  columns: ColumnBlock[];
};

/** Builds column/row schemas for a specific block union (project vs site). */
function makeColumnSchema<T extends z.ZodType>(block: T) {
  return z.object({
    id: columnIdSchema,
    blocks: z.array(block).max(MAX_BLOCKS_PER_COLUMN),
  });
}

function makeRowSchema<T extends z.ZodType>(block: T) {
  return z.object({
    id: rowIdSchema,
    type: z.literal("row"),
    columns: z.array(makeColumnSchema(block)).min(MIN_COLUMNS).max(MAX_COLUMNS),
  });
}

export const contentRowBlockSchema = makeRowSchema(contentBlockSchema);
export const siteRowBlockSchema = makeRowSchema(siteBlockSchema);

export type ContentRowBlock = z.infer<typeof contentRowBlockSchema>;
export type SiteRowBlock = z.infer<typeof siteRowBlockSchema>;

export function isImageBlock(block: Block): block is ImageBlock {
  return block.type === "image";
}

export function isVideoBlock(block: Block): block is VideoBlock {
  return block.type === "video";
}

export function isSystemBlock(block: Block): boolean {
  return SYSTEM_BLOCK_TYPES.has(block.type);
}

export function collectImageAssets(rows: RowBlock[]): Asset[] {
  const assets: Asset[] = [];
  for (const row of rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        if (isImageBlock(block)) {
          assets.push(block.asset);
        }
      }
    }
  }
  return assets;
}

export function collectMediaAssets(rows: RowBlock[]): Asset[] {
  const assets: Asset[] = [];
  for (const row of rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        if (isImageBlock(block) || isVideoBlock(block)) {
          assets.push(block.asset);
        }
      }
    }
  }
  return assets;
}

export function countImageBlocks(rows: RowBlock[]): number {
  return collectImageAssets(rows).length;
}

export function countMediaBlocks(rows: RowBlock[]): number {
  return collectMediaAssets(rows).length;
}

/** First image encountered in reading order: row, then column, then block. */
export function firstImageBlock(rows: RowBlock[]): ImageBlock | undefined {
  for (const row of rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        if (isImageBlock(block)) {
          return block;
        }
      }
    }
  }
  return undefined;
}

export function findBlocksOfType<T extends Block["type"]>(
  rows: RowBlock[],
  type: T,
): Array<Extract<Block, { type: T }>> {
  const found: Array<Extract<Block, { type: T }>> = [];
  for (const row of rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        if (block.type === type) {
          found.push(block as Extract<Block, { type: T }>);
        }
      }
    }
  }
  return found;
}
