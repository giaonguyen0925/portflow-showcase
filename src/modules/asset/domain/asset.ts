import { z } from "zod";

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MiB, pre-processing
export const MAX_IMAGE_DIMENSION = 12_000;
export const MAX_ALT_LENGTH = 300;
export const ASSET_CONTENT_TYPE = "image/webp" as const;

/** Base64 of a SHA-256 digest is always 44 characters ending in '='. */
const checksumSha256Base64 = z
  .string()
  .regex(/^[A-Za-z0-9+/]{43}=$/, { message: "Must be a base64 SHA-256 digest" });

const assetIdSchema = z
  .string()
  .regex(/^asset_[a-f0-9]{32}$/, { message: "Invalid asset id" });

export const assetSchema = z.object({
  id: assetIdSchema,
  key: z
    .string()
    .regex(/^assets\/asset_[a-f0-9]{32}\/original\.webp$/, {
      message: "Asset key must be a finalized public asset key",
    }),
  url: z.url(),
  width: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
  height: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
  contentType: z.literal(ASSET_CONTENT_TYPE),
  size: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
  checksum: checksumSha256Base64,
  alt: z.string().max(MAX_ALT_LENGTH),
  order: z.number().int().min(0),
});

export type Asset = z.infer<typeof assetSchema>;

export const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.literal(ASSET_CONTENT_TYPE, {
    error: "Only image/webp uploads are accepted; preprocess images first",
  }),
  size: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
  checksum: checksumSha256Base64,
  width: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
  height: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export function publicAssetKey(assetId: string): string {
  return `assets/${assetId}/original.webp`;
}

export function publicAssetUrl(baseUrl: string, assetId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${publicAssetKey(assetId)}`;
}
