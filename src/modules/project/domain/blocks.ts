import { z } from "zod";

import { assetSchema, type Asset } from "@/modules/asset/domain/asset";

export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 3;
export const MAX_ROWS_PER_PROJECT = 200;
export const MAX_BLOCKS_PER_COLUMN = 20;
export const MAX_TEXT_BLOCK_LENGTH = 2_000;
/** Reuses the ARD §18 "Asset/project: tối đa 100" limit, now counted across
 * every image block in the row tree instead of a flat assets array. */
export const MAX_IMAGE_BLOCKS_PER_PROJECT = 100;

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
  asset: assetSchema,
});

export type ImageBlock = z.infer<typeof imageBlockSchema>;

export const textBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("text"),
  text: z.string().max(MAX_TEXT_BLOCK_LENGTH),
});

export type TextBlock = z.infer<typeof textBlockSchema>;

/**
 * A leaf block. Nested rows (a row inside a column) are intentionally not
 * modeled yet — deferred per ADR-0001 alongside real drag-and-drop.
 */
export const blockSchema = z.discriminatedUnion("type", [
  imageBlockSchema,
  textBlockSchema,
]);

export type Block = z.infer<typeof blockSchema>;

export const columnBlockSchema = z.object({
  id: columnIdSchema,
  blocks: z.array(blockSchema).max(MAX_BLOCKS_PER_COLUMN),
});

export type ColumnBlock = z.infer<typeof columnBlockSchema>;

export const rowBlockSchema = z.object({
  id: rowIdSchema,
  type: z.literal("row"),
  columns: z.array(columnBlockSchema).min(MIN_COLUMNS).max(MAX_COLUMNS),
});

export type RowBlock = z.infer<typeof rowBlockSchema>;

export function isImageBlock(block: Block): block is ImageBlock {
  return block.type === "image";
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

export function countImageBlocks(rows: RowBlock[]): number {
  return collectImageAssets(rows).length;
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
