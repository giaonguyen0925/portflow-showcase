import type { ObjectMeta, ObjectStore } from "@/lib/r2/object-store";
import type {
  AssetStorage,
  PresignStagingOptions,
} from "@/modules/asset/application/ports";
import { ASSET_CONTENT_TYPE } from "@/modules/asset/domain/asset";

const PUBLIC_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function createR2AssetStorage(store: ObjectStore): AssetStorage {
  return {
    async presignStagingPut(
      stagingKey: string,
      options: PresignStagingOptions,
    ): Promise<string> {
      return store.presignPut("private", stagingKey, options);
    },

    async headStaging(stagingKey: string): Promise<ObjectMeta | null> {
      return store.head("private", stagingKey);
    },

    async headPublic(assetKey: string): Promise<ObjectMeta | null> {
      return store.head("public", assetKey);
    },

    async finalize(stagingKey: string, assetKey: string): Promise<void> {
      await store.copy(
        { bucket: "private", key: stagingKey },
        { bucket: "public", key: assetKey },
        {
          contentType: ASSET_CONTENT_TYPE,
          cacheControl: PUBLIC_ASSET_CACHE_CONTROL,
        },
      );
      await store.delete("private", stagingKey);
    },
  };
}
