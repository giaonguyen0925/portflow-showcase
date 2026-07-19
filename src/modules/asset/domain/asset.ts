import { z } from "zod";

export const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MiB, pre-processing
/** @deprecated Prefer MAX_IMAGE_FILE_SIZE_BYTES; kept for existing image callers. */
export const MAX_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_BYTES;
export const MAX_VIDEO_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MiB
export const MAX_IMAGE_DIMENSION = 12_000;
export const MAX_ALT_LENGTH = 300;

export const IMAGE_CONTENT_TYPE = "image/webp" as const;
export const VIDEO_CONTENT_TYPES = ["video/mp4", "video/webm"] as const;
/** @deprecated Prefer IMAGE_CONTENT_TYPE. */
export const ASSET_CONTENT_TYPE = IMAGE_CONTENT_TYPE;

export type ImageContentType = typeof IMAGE_CONTENT_TYPE;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];
export type AssetContentType = ImageContentType | VideoContentType;

export type AssetExtension = "webp" | "mp4" | "webm";

/** Base64 of a SHA-256 digest is always 44 characters ending in '='. */
const checksumSha256Base64 = z
  .string()
  .regex(/^[A-Za-z0-9+/]{43}=$/, { message: "Must be a base64 SHA-256 digest" });

const assetIdSchema = z
  .string()
  .regex(/^asset_[a-f0-9]{32}$/, { message: "Invalid asset id" });

const assetFields = {
  id: assetIdSchema,
  url: z.url(),
  width: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
  height: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
  checksum: checksumSha256Base64,
  alt: z.string().max(MAX_ALT_LENGTH),
  order: z.number().int().min(0),
};

export const imageAssetSchema = z.object({
  ...assetFields,
  key: z
    .string()
    .regex(/^assets\/asset_[a-f0-9]{32}\/original\.webp$/, {
      message: "Image asset key must end with original.webp",
    }),
  contentType: z.literal(IMAGE_CONTENT_TYPE),
  size: z.number().int().min(1).max(MAX_IMAGE_FILE_SIZE_BYTES),
});

export const videoAssetSchema = z.object({
  ...assetFields,
  key: z
    .string()
    .regex(/^assets\/asset_[a-f0-9]{32}\/original\.(mp4|webm)$/, {
      message: "Video asset key must end with original.mp4 or original.webm",
    }),
  contentType: z.enum(VIDEO_CONTENT_TYPES),
  size: z.number().int().min(1).max(MAX_VIDEO_FILE_SIZE_BYTES),
});

export const assetSchema = z.union([imageAssetSchema, videoAssetSchema]);

export type ImageAsset = z.infer<typeof imageAssetSchema>;
export type VideoAsset = z.infer<typeof videoAssetSchema>;
export type Asset = z.infer<typeof assetSchema>;

export function isVideoContentType(
  contentType: string,
): contentType is VideoContentType {
  return (
    contentType === "video/mp4" || contentType === "video/webm"
  );
}

export function isImageAsset(asset: Asset): asset is ImageAsset {
  return asset.contentType === IMAGE_CONTENT_TYPE;
}

export function isVideoAsset(asset: Asset): asset is VideoAsset {
  return isVideoContentType(asset.contentType);
}

export function extensionForContentType(
  contentType: AssetContentType,
): AssetExtension {
  switch (contentType) {
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
  }
}

export const uploadRequestSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    contentType: z.enum([IMAGE_CONTENT_TYPE, ...VIDEO_CONTENT_TYPES], {
      error:
        "Only image/webp, video/mp4, and video/webm uploads are accepted",
    }),
    size: z.number().int().min(1).max(MAX_VIDEO_FILE_SIZE_BYTES),
    checksum: checksumSha256Base64,
    width: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
    height: z.number().int().min(1).max(MAX_IMAGE_DIMENSION),
  })
  .superRefine((data, ctx) => {
    if (
      data.contentType === IMAGE_CONTENT_TYPE &&
      data.size > MAX_IMAGE_FILE_SIZE_BYTES
    ) {
      ctx.addIssue({
        code: "too_big",
        maximum: MAX_IMAGE_FILE_SIZE_BYTES,
        origin: "number",
        inclusive: true,
        path: ["size"],
        message: `Image uploads must be at most ${MAX_IMAGE_FILE_SIZE_BYTES} bytes`,
      });
    }
  });

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/** Image-only key reconstruction (avatar / cover URLs from asset id alone). */
export function publicAssetKey(
  assetId: string,
  contentType: AssetContentType = IMAGE_CONTENT_TYPE,
): string {
  return `assets/${assetId}/original.${extensionForContentType(contentType)}`;
}

export function publicAssetUrl(
  baseUrl: string,
  assetId: string,
  contentType: AssetContentType = IMAGE_CONTENT_TYPE,
): string {
  return `${baseUrl.replace(/\/$/, "")}/${publicAssetKey(assetId, contentType)}`;
}
