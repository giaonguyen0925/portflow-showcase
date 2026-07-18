import { createBlockId, createColumnId, createRowId } from "@/lib/ids/ids";
import type { RowBlock } from "@/modules/project/domain/blocks";

import { makeAsset } from "./assets";

export function makeImageRow(
  order = 0,
  assetOverrides: Parameters<typeof makeAsset>[1] = {},
): RowBlock {
  return {
    id: createRowId(),
    type: "row",
    columns: [
      {
        id: createColumnId(),
        blocks: [
          { id: createBlockId(), type: "image", asset: makeAsset(order, assetOverrides) },
        ],
      },
    ],
  };
}

export function makeTextRow(text = "Hello"): RowBlock {
  return {
    id: createRowId(),
    type: "row",
    columns: [{ id: createColumnId(), blocks: [{ id: createBlockId(), type: "text", text }] }],
  };
}

export function makeEmptyRow(columnCount = 3): RowBlock {
  return {
    id: createRowId(),
    type: "row",
    columns: Array.from({ length: columnCount }, () => ({
      id: createColumnId(),
      blocks: [],
    })),
  };
}
