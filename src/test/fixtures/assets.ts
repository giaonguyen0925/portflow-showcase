import { createHash } from "node:crypto";

import { createAssetId } from "@/lib/ids/ids";
import type { Asset, ImageAsset, VideoAsset } from "@/modules/asset/domain/asset";

export const TEST_ASSET_BASE_URL = "https://assets.example.com";

export function makeChecksum(seed = "seed"): string {
  return createHash("sha256").update(seed).digest("base64");
}

export function makeAsset(
  order: number,
  overrides: Partial<Omit<ImageAsset, "contentType">> = {},
): ImageAsset {
  const id =
    typeof overrides.id === "string" ? overrides.id : createAssetId();
  return {
    id,
    key: overrides.key ?? `assets/${id}/original.webp`,
    url: overrides.url ?? `${TEST_ASSET_BASE_URL}/assets/${id}/original.webp`,
    width: overrides.width ?? 1600,
    height: overrides.height ?? 1000,
    contentType: "image/webp",
    size: overrides.size ?? 123_456,
    checksum: overrides.checksum ?? makeChecksum(id),
    alt: overrides.alt ?? "",
    order: overrides.order ?? order,
  };
}

export function makeVideoAsset(
  order: number,
  overrides: Partial<Omit<VideoAsset, "contentType">> & {
    contentType?: VideoAsset["contentType"];
  } = {},
): VideoAsset {
  const id =
    typeof overrides.id === "string" ? overrides.id : createAssetId();
  const contentType = overrides.contentType ?? "video/mp4";
  const extension = contentType === "video/webm" ? "webm" : "mp4";
  return {
    id,
    key: overrides.key ?? `assets/${id}/original.${extension}`,
    url:
      overrides.url ??
      `${TEST_ASSET_BASE_URL}/assets/${id}/original.${extension}`,
    width: overrides.width ?? 1920,
    height: overrides.height ?? 1080,
    contentType,
    size: overrides.size ?? 2_000_000,
    checksum: overrides.checksum ?? makeChecksum(id),
    alt: overrides.alt ?? "",
    order: overrides.order ?? order,
  };
}

/** Convenience when a test needs either shape without caring which. */
export function makeAnyAsset(
  order: number,
  overrides: Partial<Asset> = {},
): Asset {
  if (
    overrides.contentType === "video/mp4" ||
    overrides.contentType === "video/webm"
  ) {
    return makeVideoAsset(order, overrides);
  }
  const { contentType: _ignored, ...rest } = overrides;
  return makeAsset(order, rest);
}
