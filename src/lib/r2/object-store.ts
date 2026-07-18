export type BucketName = "private" | "public";

export type ObjectMeta = {
  size: number;
  contentType?: string | undefined;
  /** Base64 SHA-256 reported by storage, when available. */
  checksumSha256?: string | undefined;
};

export type PresignPutOptions = {
  contentType: string;
  contentLength: number;
  checksumSha256: string;
  expiresInSeconds: number;
};

export type PutJsonOptions = {
  cacheControl?: string;
};

export type CopyOptions = {
  contentType: string;
  cacheControl: string;
};

/**
 * Minimal storage port shared by every repository. Implemented by R2 in
 * production and by an in-memory fake in tests.
 */
export interface ObjectStore {
  getJson(bucket: BucketName, key: string): Promise<unknown | null>;
  putJson(
    bucket: BucketName,
    key: string,
    value: unknown,
    options?: PutJsonOptions,
  ): Promise<void>;
  head(bucket: BucketName, key: string): Promise<ObjectMeta | null>;
  copy(
    from: { bucket: BucketName; key: string },
    to: { bucket: BucketName; key: string },
    options: CopyOptions,
  ): Promise<void>;
  delete(bucket: BucketName, key: string): Promise<void>;
  presignPut(
    bucket: BucketName,
    key: string,
    options: PresignPutOptions,
  ): Promise<string>;
}
