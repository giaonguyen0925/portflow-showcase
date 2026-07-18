import type { ObjectMeta } from "@/lib/r2/object-store";

export type PresignStagingOptions = {
  contentType: string;
  contentLength: number;
  checksumSha256: string;
  expiresInSeconds: number;
};

export interface AssetStorage {
  presignStagingPut(
    stagingKey: string,
    options: PresignStagingOptions,
  ): Promise<string>;
  headStaging(stagingKey: string): Promise<ObjectMeta | null>;
  headPublic(assetKey: string): Promise<ObjectMeta | null>;
  /** Copies staging object to its immutable public key, then removes staging. */
  finalize(stagingKey: string, assetKey: string): Promise<void>;
}
