import { describe, expect, it } from "vitest";

import { createBlockId, createColumnId, createRowId } from "@/lib/ids/ids";
import type { RowBlock } from "@/modules/layout/domain/blocks";
import {
  DEFAULT_IMAGE_CROP,
  resolveImageCropRect,
  rowMediaAspectRatio,
} from "@/modules/layout/domain/image-crop";
import { makeAsset } from "@/test/fixtures/assets";

function mediaRow(
  cells: Array<{ width: number; height: number } | null>,
): RowBlock {
  return {
    id: createRowId(),
    type: "row",
    columns: cells.map((cell) => ({
      id: createColumnId(),
      blocks:
        cell === null
          ? []
          : [
              {
                id: createBlockId(),
                type: "image" as const,
                asset: makeAsset(0, {
                  width: cell.width,
                  height: cell.height,
                }),
              },
            ],
    })),
  };
}

describe("rowMediaAspectRatio", () => {
  it("returns undefined when the row has no media", () => {
    expect(rowMediaAspectRatio(mediaRow([null, null]))).toBeUndefined();
  });

  it("uses the tallest first-per-column media as the aspect base", () => {
    // Landscape 2:1 vs portrait 1:2 → portrait is taller → aspect 0.5
    const ratio = rowMediaAspectRatio(
      mediaRow([
        { width: 2000, height: 1000 },
        { width: 1000, height: 2000 },
      ]),
    );
    expect(ratio).toBeCloseTo(0.5);
  });

  it("ignores empty columns when picking the base", () => {
    const ratio = rowMediaAspectRatio(
      mediaRow([null, { width: 1600, height: 900 }]),
    );
    expect(ratio).toBeCloseTo(1600 / 900);
  });
});

describe("resolveImageCropRect", () => {
  it("covers a landscape image into a square with a centered default crop", () => {
    const rect = resolveImageCropRect(2000, 1000, 1, DEFAULT_IMAGE_CROP);
    expect(rect.height).toBeCloseTo(1);
    expect(rect.width).toBeCloseTo(0.5);
    expect(rect.left).toBeCloseTo(0.25);
    expect(rect.top).toBeCloseTo(0);
  });

  it("shrinks the visible rect when zooming in", () => {
    const base = resolveImageCropRect(1000, 1000, 1, DEFAULT_IMAGE_CROP);
    const zoomed = resolveImageCropRect(1000, 1000, 1, {
      x: 0.5,
      y: 0.5,
      zoom: 2,
    });
    expect(zoomed.width).toBeCloseTo(base.width / 2);
    expect(zoomed.height).toBeCloseTo(base.height / 2);
    expect(zoomed.left).toBeCloseTo(0.25);
    expect(zoomed.top).toBeCloseTo(0.25);
  });

  it("clamps the rect when the focal point is near an edge", () => {
    const rect = resolveImageCropRect(2000, 1000, 1, {
      x: 0,
      y: 0.5,
      zoom: 1,
    });
    expect(rect.left).toBeCloseTo(0);
    expect(rect.width).toBeCloseTo(0.5);
  });
});
