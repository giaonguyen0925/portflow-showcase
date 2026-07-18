import { z } from "zod";

import { createAssetId, createUploadId } from "@/lib/ids/ids";
import { privateKeys } from "@/lib/r2/keys";
import {
  publicAssetKey,
  uploadRequestSchema,
} from "@/modules/asset/domain/asset";
import {
  FINALIZE_TOKEN_TTL_MS,
  signFinalizeToken,
} from "@/modules/asset/domain/finalize-token";

import type { AssetStorage } from "./ports";

/** Presigned PUT URLs are deliberately short-lived (ARD §13.1). */
export const PRESIGN_EXPIRES_SECONDS = 90;

export const warmUpResponseSchema = z.object({
  uploadId: z.string(),
  assetId: z.string(),
  uploadUrl: z.url(),
  finalizeToken: z.string(),
  uploadUrlExpiresInSeconds: z.number(),
});

export type WarmUpResponse = z.infer<typeof warmUpResponseSchema>;

export async function warmUpUpload(
  deps: { storage: AssetStorage; uploadTokenSecret: string },
  input: unknown,
): Promise<WarmUpResponse> {
  const parsed = uploadRequestSchema.parse(input);

  const uploadId = createUploadId();
  const assetId = createAssetId();
  const stagingKey = privateKeys.stagingUpload(uploadId);

  const uploadUrl = await deps.storage.presignStagingPut(stagingKey, {
    contentType: parsed.contentType,
    contentLength: parsed.size,
    checksumSha256: parsed.checksum,
    expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
  });

  const finalizeToken = signFinalizeToken(
    {
      uploadId,
      assetId,
      stagingKey,
      checksum: parsed.checksum,
      size: parsed.size,
      width: parsed.width,
      height: parsed.height,
      contentType: parsed.contentType,
      expiresAt: new Date(Date.now() + FINALIZE_TOKEN_TTL_MS).toISOString(),
    },
    deps.uploadTokenSecret,
  );

  return {
    uploadId,
    assetId,
    uploadUrl,
    finalizeToken,
    uploadUrlExpiresInSeconds: PRESIGN_EXPIRES_SECONDS,
  };
}

// Re-exported here so route-level code can reference the asset key shape
// without importing domain internals directly.
export { publicAssetKey };
