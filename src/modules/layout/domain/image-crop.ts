import { z } from "zod";

import type { RowBlock } from "@/modules/layout/domain/blocks";

export const MIN_IMAGE_CROP_ZOOM = 1;
export const MAX_IMAGE_CROP_ZOOM = 5;

export const imageCropSchema = z.object({
  /** Horizontal center of the visible region, 0–1 across image width. */
  x: z.number().min(0).max(1),
  /** Vertical center of the visible region, 0–1 across image height. */
  y: z.number().min(0).max(1),
  /** Zoom ≥ 1; 1 is the minimal cover scale for the target aspect. */
  zoom: z.number().min(MIN_IMAGE_CROP_ZOOM).max(MAX_IMAGE_CROP_ZOOM),
});

export type ImageCrop = z.infer<typeof imageCropSchema>;

export const DEFAULT_IMAGE_CROP: ImageCrop = { x: 0.5, y: 0.5, zoom: 1 };

export function normalizeImageCrop(
  crop: ImageCrop | undefined,
): ImageCrop {
  if (!crop) return DEFAULT_IMAGE_CROP;
  return {
    x: clamp(crop.x, 0, 1),
    y: clamp(crop.y, 0, 1),
    zoom: clamp(crop.zoom, MIN_IMAGE_CROP_ZOOM, MAX_IMAGE_CROP_ZOOM),
  };
}

/** True when crop matches the default center/cover framing. */
export function isDefaultImageCrop(crop: ImageCrop | undefined): boolean {
  if (!crop) return true;
  const normalized = normalizeImageCrop(crop);
  return (
    normalized.x === DEFAULT_IMAGE_CROP.x &&
    normalized.y === DEFAULT_IMAGE_CROP.y &&
    normalized.zoom === DEFAULT_IMAGE_CROP.zoom
  );
}

/**
 * Width/height aspect for a row's media band: among the first image/video in
 * each column, pick the tallest (`height/width`), then return its width/height.
 */
export function rowMediaAspectRatio(row: RowBlock): number | undefined {
  let tallest:
    | { width: number; height: number; tallness: number }
    | undefined;

  for (const column of row.columns) {
    const media = column.blocks.find(
      (block) => block.type === "image" || block.type === "video",
    );
    if (!media || (media.type !== "image" && media.type !== "video")) {
      continue;
    }
    const { width, height } = media.asset;
    if (width <= 0 || height <= 0) continue;
    const tallness = height / width;
    if (!tallest || tallness > tallest.tallness) {
      tallest = { width, height, tallness };
    }
  }

  if (!tallest) return undefined;
  return tallest.width / tallest.height;
}

export type ImageCropRect = {
  /** Left edge as a fraction of source width (0–1). */
  left: number;
  /** Top edge as a fraction of source height (0–1). */
  top: number;
  /** Visible width as a fraction of source width (0–1). */
  width: number;
  /** Visible height as a fraction of source height (0–1). */
  height: number;
};

/**
 * Normalized source rectangle shown when covering `targetAspect` (width/height)
 * with the given focal crop.
 */
export function resolveImageCropRect(
  imageWidth: number,
  imageHeight: number,
  targetAspect: number,
  crop: ImageCrop | undefined,
): ImageCropRect {
  const { x, y, zoom } = normalizeImageCrop(crop);
  const imageAspect = imageWidth / imageHeight;

  let width: number;
  let height: number;
  if (imageAspect > targetAspect) {
    height = 1;
    width = targetAspect / imageAspect;
  } else {
    width = 1;
    height = imageAspect / targetAspect;
  }

  width = Math.min(width / zoom, 1);
  height = Math.min(height / zoom, 1);

  const left = clamp(x - width / 2, 0, 1 - width);
  const top = clamp(y - height / 2, 0, 1 - height);

  return { left, top, width, height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
