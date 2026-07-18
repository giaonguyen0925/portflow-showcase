import { describe, expect, it } from "vitest";

import { makeImageRow, makeTextRow } from "@/test/fixtures/rows";

import { collectImageAssets, countImageBlocks, firstImageBlock } from "./blocks";

describe("collectImageAssets / countImageBlocks", () => {
  it("collects every image asset across rows and columns in reading order", () => {
    const rows = [makeImageRow(0), makeTextRow("caption"), makeImageRow(1)];

    const assets = collectImageAssets(rows);

    expect(assets).toHaveLength(2);
    expect(countImageBlocks(rows)).toBe(2);
  });

  it("returns an empty list for rows with no images", () => {
    expect(collectImageAssets([makeTextRow()])).toEqual([]);
  });
});

describe("firstImageBlock", () => {
  it("returns the first image encountered in row/column/block order", () => {
    const target = makeImageRow(0);
    const rows = [makeTextRow(), target, makeImageRow(1)];

    const first = firstImageBlock(rows);

    expect(first?.asset.id).toBe(
      (target.columns[0]?.blocks[0] as { asset: { id: string } }).asset.id,
    );
  });

  it("returns undefined when there are no images", () => {
    expect(firstImageBlock([makeTextRow()])).toBeUndefined();
  });
});
