import { privateKeys } from "@/lib/r2/keys";
import type { ObjectStore } from "@/lib/r2/object-store";
import type { ReleaseRepository } from "@/modules/publishing/application/ports";
import {
  currentPointerSchema,
  releaseManifestSchema,
  releaseProjectSchema,
  releaseSiteSchema,
  type CurrentPointer,
  type ReleaseManifest,
  type ReleaseProject,
  type ReleaseSite,
} from "@/modules/publishing/domain/release";

/** Release snapshots are immutable; only current.json is ever rewritten. */
const RELEASE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function createR2ReleaseRepository(
  store: ObjectStore,
): ReleaseRepository {
  return {
    async writeSite(releaseId: string, site: ReleaseSite): Promise<void> {
      await store.putJson("private", privateKeys.releaseSite(releaseId), site, {
        cacheControl: RELEASE_CACHE_CONTROL,
      });
    },

    async writeProject(
      releaseId: string,
      slug: string,
      project: ReleaseProject,
    ): Promise<void> {
      await store.putJson(
        "private",
        privateKeys.releaseProject(releaseId, slug),
        project,
        { cacheControl: RELEASE_CACHE_CONTROL },
      );
    },

    async writeManifest(manifest: ReleaseManifest): Promise<void> {
      await store.putJson(
        "private",
        privateKeys.releaseManifest(manifest.releaseId),
        manifest,
        { cacheControl: RELEASE_CACHE_CONTROL },
      );
    },

    async readCurrent(): Promise<CurrentPointer | null> {
      const raw = await store.getJson("private", privateKeys.currentPointer());
      return raw === null ? null : currentPointerSchema.parse(raw);
    },

    async writeCurrent(pointer: CurrentPointer): Promise<void> {
      await store.putJson("private", privateKeys.currentPointer(), pointer, {
        cacheControl: "no-store",
      });
    },

    async readManifest(releaseId: string): Promise<ReleaseManifest | null> {
      const raw = await store.getJson(
        "private",
        privateKeys.releaseManifest(releaseId),
      );
      return raw === null ? null : releaseManifestSchema.parse(raw);
    },

    async readSite(releaseId: string): Promise<ReleaseSite | null> {
      const raw = await store.getJson(
        "private",
        privateKeys.releaseSite(releaseId),
      );
      return raw === null ? null : releaseSiteSchema.parse(raw);
    },

    async readProject(
      releaseId: string,
      slug: string,
    ): Promise<ReleaseProject | null> {
      const raw = await store.getJson(
        "private",
        privateKeys.releaseProject(releaseId, slug),
      );
      return raw === null ? null : releaseProjectSchema.parse(raw);
    },
  };
}
