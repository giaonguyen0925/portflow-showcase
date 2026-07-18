import { z } from "zod";

import { AppError } from "@/lib/api/app-error";
import {
  publicAssetKey,
  publicAssetUrl,
  type Asset,
} from "@/modules/asset/domain/asset";
import { verifyFinalizeToken } from "@/modules/asset/domain/finalize-token";

import type { AssetStorage } from "./ports";

const completeUploadInputSchema = z.object({
  uploadId: z.string().regex(/^upload_[a-f0-9]{32}$/),
  finalizeToken: z.string().min(1),
});

/**
 * Verifies the staged upload and promotes it to its immutable public key.
 * Idempotent per uploadId: retries after a successful finalize return the
 * same asset metadata.
 */
export async function completeUpload(
  deps: {
    storage: AssetStorage;
    uploadTokenSecret: string;
    assetBaseUrl: string;
  },
  input: unknown,
): Promise<Asset> {
  const parsed = completeUploadInputSchema.parse(input);
  const payload = verifyFinalizeToken(
    parsed.finalizeToken,
    deps.uploadTokenSecret,
  );

  if (payload.uploadId !== parsed.uploadId) {
    throw new AppError(
      "UPLOAD_EXPIRED",
      "Finalize token does not match this upload",
    );
  }

  const assetKey = publicAssetKey(payload.assetId);
  const asset: Asset = {
    id: payload.assetId,
    key: assetKey,
    url: publicAssetUrl(deps.assetBaseUrl, payload.assetId),
    width: payload.width,
    height: payload.height,
    contentType: "image/webp",
    size: payload.size,
    checksum: payload.checksum,
    alt: "",
    order: 0,
  };

  const alreadyFinalized = await deps.storage.headPublic(assetKey);
  if (alreadyFinalized) {
    return asset;
  }

  const staging = await deps.storage.headStaging(payload.stagingKey);
  if (!staging) {
    throw new AppError(
      "UPLOAD_EXPIRED",
      "Staged upload is missing or has expired",
    );
  }

  if (staging.size !== payload.size) {
    throw new AppError("INVALID_ASSET", "Uploaded size does not match", {
      expected: payload.size,
      actual: staging.size,
    });
  }

  if (staging.contentType && staging.contentType !== payload.contentType) {
    throw new AppError("INVALID_ASSET", "Uploaded content type does not match");
  }

  if (staging.checksumSha256 && staging.checksumSha256 !== payload.checksum) {
    throw new AppError("INVALID_ASSET", "Uploaded checksum does not match");
  }

  await deps.storage.finalize(payload.stagingKey, assetKey);

  return asset;
}
