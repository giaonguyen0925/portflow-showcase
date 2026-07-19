import { describe, expect, it } from "vitest";

import { privateKeys, publicKeys } from "./keys";

describe("R2 key builders", () => {
  it("builds expected keys", () => {
    expect(privateKeys.projectDraft("project_abc123")).toBe(
      "content/projects/project_abc123/draft.json",
    );
    expect(publicKeys.assetOriginal("asset_abc")).toBe(
      "assets/asset_abc/original.webp",
    );
    expect(publicKeys.assetOriginal("asset_abc", "mp4")).toBe(
      "assets/asset_abc/original.mp4",
    );
  });

  it("rejects path traversal in dynamic segments", () => {
    expect(() => privateKeys.projectDraft("../current")).toThrow();
    expect(() => privateKeys.projectDraft("a/../../b")).toThrow();
    expect(() => privateKeys.releaseProject("release_1", "../../site")).toThrow();
    expect(() => privateKeys.stagingUpload("upload/../content")).toThrow();
    expect(() => publicKeys.assetOriginal("..")).toThrow();
    expect(() => privateKeys.projectDraft("")).toThrow();
  });

  it("rejects keys that start with separators or dots", () => {
    expect(() => privateKeys.projectDraft(".hidden")).toThrow();
    expect(() => privateKeys.projectDraft("-flag")).toThrow();
  });
});
