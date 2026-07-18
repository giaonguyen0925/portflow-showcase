import { createHash } from "node:crypto";

import { createAssetId } from "@/lib/ids/ids";
import type { Asset } from "@/modules/asset/domain/asset";

export const TEST_ASSET_BASE_URL = "https://assets.example.com";

export function makeChecksum(seed = "seed"): string {
  return createHash("sha256").update(seed).digest("base64");
}

export function makeAsset(order: number, overrides: Partial<Asset> = {}): Asset {
  const id = createAssetId();
  return {
    id,
    key: `assets/${id}/original.webp`,
    url: `${TEST_ASSET_BASE_URL}/assets/${id}/original.webp`,
    width: 1600,
    height: 1000,
    contentType: "image/webp",
    size: 123_456,
    checksum: makeChecksum(id),
    alt: "",
    order,
    ...overrides,
  };
}
