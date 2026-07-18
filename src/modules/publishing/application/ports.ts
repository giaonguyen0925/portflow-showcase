import type {
  CurrentPointer,
  ReleaseManifest,
  ReleaseProject,
  ReleaseSite,
} from "@/modules/publishing/domain/release";

export interface ReleaseRepository {
  writeSite(releaseId: string, site: ReleaseSite): Promise<void>;
  writeProject(
    releaseId: string,
    slug: string,
    project: ReleaseProject,
  ): Promise<void>;
  writeManifest(manifest: ReleaseManifest): Promise<void>;
  readCurrent(): Promise<CurrentPointer | null>;
  writeCurrent(pointer: CurrentPointer): Promise<void>;
  readManifest(releaseId: string): Promise<ReleaseManifest | null>;
  readSite(releaseId: string): Promise<ReleaseSite | null>;
  readProject(releaseId: string, slug: string): Promise<ReleaseProject | null>;
}
