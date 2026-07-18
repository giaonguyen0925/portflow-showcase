import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { AppError } from "@/lib/api/app-error";
import { getServerEnv } from "@/lib/env/server";
import { logServerEvent } from "@/lib/observability/logger";

import type {
  BucketName,
  CopyOptions,
  ObjectMeta,
  ObjectStore,
  PresignPutOptions,
  PutJsonOptions,
} from "./object-store";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

let cachedClient: S3Client | undefined;

function getClient(): S3Client {
  if (!cachedClient) {
    const env = getServerEnv();
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      // R2 rejects the SDK's default implicit CRC checksums.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return cachedClient;
}

function bucketName(bucket: BucketName): string {
  const env = getServerEnv();
  return bucket === "private" ? env.R2_PRIVATE_BUCKET : env.R2_PUBLIC_BUCKET;
}

function isNotFound(error: unknown): boolean {
  if (error instanceof S3ServiceException) {
    return (
      error.name === "NoSuchKey" ||
      error.name === "NotFound" ||
      error.$metadata.httpStatusCode === 404
    );
  }
  return false;
}

function toStorageError(error: unknown, operation: string): AppError {
  logServerEvent("error", "r2.storage-error", {
    r2Operation: operation,
    errorName: error instanceof Error ? error.name : "unknown",
  });
  return new AppError("STORAGE_UNAVAILABLE", "Storage is temporarily unavailable");
}

class R2ObjectStore implements ObjectStore {
  async getJson(bucket: BucketName, key: string): Promise<unknown | null> {
    try {
      const result = await getClient().send(
        new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }),
      );
      const body = await result.Body?.transformToString("utf-8");
      return body ? (JSON.parse(body) as unknown) : null;
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw toStorageError(error, `getJson ${key}`);
    }
  }

  async putJson(
    bucket: BucketName,
    key: string,
    value: unknown,
    options?: PutJsonOptions,
  ): Promise<void> {
    try {
      await getClient().send(
        new PutObjectCommand({
          Bucket: bucketName(bucket),
          Key: key,
          Body: JSON.stringify(value),
          ContentType: JSON_CONTENT_TYPE,
          CacheControl: options?.cacheControl ?? "no-store",
        }),
      );
    } catch (error) {
      throw toStorageError(error, `putJson ${key}`);
    }
  }

  async head(bucket: BucketName, key: string): Promise<ObjectMeta | null> {
    try {
      const result = await getClient().send(
        new HeadObjectCommand({
          Bucket: bucketName(bucket),
          Key: key,
          ChecksumMode: "ENABLED",
        }),
      );
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType,
        checksumSha256: result.ChecksumSHA256,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw toStorageError(error, `head ${key}`);
    }
  }

  async copy(
    from: { bucket: BucketName; key: string },
    to: { bucket: BucketName; key: string },
    options: CopyOptions,
  ): Promise<void> {
    try {
      await getClient().send(
        new CopyObjectCommand({
          Bucket: bucketName(to.bucket),
          Key: to.key,
          CopySource: `${bucketName(from.bucket)}/${from.key}`,
          MetadataDirective: "REPLACE",
          ContentType: options.contentType,
          CacheControl: options.cacheControl,
        }),
      );
    } catch (error) {
      throw toStorageError(error, `copy ${from.key} -> ${to.key}`);
    }
  }

  async delete(bucket: BucketName, key: string): Promise<void> {
    try {
      await getClient().send(
        new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }),
      );
    } catch (error) {
      throw toStorageError(error, `delete ${key}`);
    }
  }

  async presignPut(
    bucket: BucketName,
    key: string,
    options: PresignPutOptions,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName(bucket),
        Key: key,
        ContentType: options.contentType,
        ContentLength: options.contentLength,
        ChecksumSHA256: options.checksumSha256,
      });
      return await getSignedUrl(getClient(), command, {
        expiresIn: options.expiresInSeconds,
      });
    } catch (error) {
      throw toStorageError(error, `presignPut ${key}`);
    }
  }
}

let cachedStore: ObjectStore | undefined;

export function getR2ObjectStore(): ObjectStore {
  cachedStore ??= new R2ObjectStore();
  return cachedStore;
}
