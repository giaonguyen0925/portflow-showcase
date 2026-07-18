import type {
  BucketName,
  CopyOptions,
  ObjectMeta,
  ObjectStore,
  PresignPutOptions,
} from "@/lib/r2/object-store";

type StoredObject = {
  json?: unknown;
  meta: ObjectMeta;
};

/**
 * In-memory ObjectStore for tests. `failOnKey` lets tests simulate storage
 * failures on specific keys (e.g. to verify publish rollback behavior).
 */
export class FakeObjectStore implements ObjectStore {
  readonly objects = new Map<string, StoredObject>();
  readonly writeLog: string[] = [];
  failOnKey: ((bucket: BucketName, key: string) => boolean) | undefined;

  private id(bucket: BucketName, key: string): string {
    return `${bucket}:${key}`;
  }

  private maybeFail(bucket: BucketName, key: string): void {
    if (this.failOnKey?.(bucket, key)) {
      throw new Error(`Injected storage failure for ${bucket}:${key}`);
    }
  }

  /** Test helper: put a raw binary-ish object (staging uploads). */
  setObject(bucket: BucketName, key: string, meta: ObjectMeta): void {
    this.objects.set(this.id(bucket, key), { meta });
  }

  getStoredJson(bucket: BucketName, key: string): unknown {
    return this.objects.get(this.id(bucket, key))?.json;
  }

  has(bucket: BucketName, key: string): boolean {
    return this.objects.has(this.id(bucket, key));
  }

  async getJson(bucket: BucketName, key: string): Promise<unknown | null> {
    this.maybeFail(bucket, key);
    const stored = this.objects.get(this.id(bucket, key));
    return stored?.json === undefined
      ? null
      : JSON.parse(JSON.stringify(stored.json));
  }

  async putJson(
    bucket: BucketName,
    key: string,
    value: unknown,
  ): Promise<void> {
    this.maybeFail(bucket, key);
    this.writeLog.push(this.id(bucket, key));
    this.objects.set(this.id(bucket, key), {
      json: JSON.parse(JSON.stringify(value)),
      meta: {
        size: JSON.stringify(value).length,
        contentType: "application/json; charset=utf-8",
      },
    });
  }

  async head(bucket: BucketName, key: string): Promise<ObjectMeta | null> {
    this.maybeFail(bucket, key);
    return this.objects.get(this.id(bucket, key))?.meta ?? null;
  }

  async copy(
    from: { bucket: BucketName; key: string },
    to: { bucket: BucketName; key: string },
    options: CopyOptions,
  ): Promise<void> {
    this.maybeFail(to.bucket, to.key);
    const source = this.objects.get(this.id(from.bucket, from.key));
    if (!source) {
      throw new Error(`Copy source missing: ${from.bucket}:${from.key}`);
    }
    this.writeLog.push(this.id(to.bucket, to.key));
    this.objects.set(this.id(to.bucket, to.key), {
      ...source,
      meta: { ...source.meta, contentType: options.contentType },
    });
  }

  async delete(bucket: BucketName, key: string): Promise<void> {
    this.maybeFail(bucket, key);
    this.objects.delete(this.id(bucket, key));
  }

  async presignPut(
    bucket: BucketName,
    key: string,
    options: PresignPutOptions,
  ): Promise<string> {
    this.maybeFail(bucket, key);
    return `https://fake-presigned.example.com/${bucket}/${key}?expires=${options.expiresInSeconds}`;
  }
}
