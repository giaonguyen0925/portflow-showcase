import { createBlockId, createColumnId, createRowId } from "@/lib/ids/ids";
import {
  isVideoAsset,
  type Asset,
  type ImageAsset,
  type VideoAsset,
} from "@/modules/asset/domain/asset";
import { createEmptyRichTextDocument } from "@/modules/rich-text/domain/rich-text-document";

import {
  isSystemBlock,
  type Block,
  type ColumnBlock,
  type ImageBlock,
  type ProfileBlock,
  type ProjectGridBlock,
  type RichTextBlock,
  type RowBlock,
  type VideoBlock,
} from "./blocks";

export function createEmptyColumn(): ColumnBlock {
  return { id: createColumnId(), blocks: [] };
}

export function createEmptyRow(columnCount: number): RowBlock {
  return {
    id: createRowId(),
    type: "row",
    columns: Array.from({ length: columnCount }, () => createEmptyColumn()),
  };
}

export function createImageBlockFromAsset(asset: ImageAsset): ImageBlock {
  return { id: createBlockId(), type: "image", asset };
}

export function createVideoBlockFromAsset(asset: VideoAsset): VideoBlock {
  return { id: createBlockId(), type: "video", asset };
}

/** Picks image vs video block from finalized upload metadata. */
export function createMediaBlockFromAsset(
  asset: Asset,
): ImageBlock | VideoBlock {
  if (isVideoAsset(asset)) {
    return createVideoBlockFromAsset(asset);
  }
  return createImageBlockFromAsset(asset);
}

export function createRichTextBlock(): RichTextBlock {
  return {
    id: createBlockId(),
    type: "rich-text",
    content: createEmptyRichTextDocument(),
  };
}

export function createProfileBlock(): ProfileBlock {
  return {
    id: createBlockId(),
    type: "profile",
    align: "left",
    showAvatar: true,
    showBio: true,
    showSocialLinks: true,
  };
}

export function createProjectGridBlock(): ProjectGridBlock {
  return {
    id: createBlockId(),
    type: "project-grid",
    columns: 2,
    showCover: true,
    showTitle: true,
    showSummary: true,
    gap: "normal",
  };
}

/** Wraps a block in its own single-column row (how system blocks are added). */
export function createRowWithBlock(block: Block): RowBlock {
  const row = createEmptyRow(1);
  const column = row.columns[0];
  if (column) {
    column.blocks = [block];
  }
  return row;
}

/**
 * Fully independent copy of a row: fresh ids at every level and
 * structured-cloned block payloads, so nested content (e.g. rich-text JSON)
 * can be edited on the clone without mutating the original. System blocks
 * (profile, project-grid) must stay unique per site layout, so they are
 * dropped from the clone rather than duplicated (ADR-0002).
 */
export function cloneRowDeep(row: RowBlock): RowBlock {
  return {
    id: createRowId(),
    type: "row",
    columns: row.columns.map((column) => ({
      id: createColumnId(),
      blocks: column.blocks
        .filter((block) => !isSystemBlock(block))
        .map(
          (block): Block => ({ ...structuredClone(block), id: createBlockId() }),
        ),
    })),
  };
}
