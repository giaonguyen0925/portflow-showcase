import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/app-error";
import { createR2AssetStorage } from "@/modules/asset/infrastructure/r2-asset-storage";
import { FakeObjectStore } from "@/test/fakes/fake-object-store";
import { makeChecksum, TEST_ASSET_BASE_URL } from "@/test/fixtures/assets";

import { completeUpload } from "./complete-upload";
import { warmUpUpload } from "./warm-up-upload";

const SECRET = "0123456789abcdef0123456789abcdef";

function setup() {
  const store = new FakeObjectStore();
  const storage = createR2AssetStorage(store);
  return { store, storage };
}

function validWarmUpInput(overrides: Record<string, unknown> = {}) {
  return {
    fileName: "project-cover.png",
    contentType: "image/webp",
    size: 812_312,
    checksum: makeChecksum("upload"),
    width: 1600,
    height: 2200,
    ...overrides,
  };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
  }
}

describe("warmUpUpload", () => {
  it("returns a presigned URL and finalize token", async () => {
    const { storage } = setup();

    const result = await warmUpUpload(
      { storage, uploadTokenSecret: SECRET },
      validWarmUpInput(),
    );

    expect(result.uploadUrl).toContain(result.uploadId);
    expect(result.finalizeToken).toContain(".");
    expect(result.uploadUrlExpiresInSeconds).toBeLessThanOrEqual(90);
  });

  it("rejects oversized files", async () => {
    const { storage } = setup();

    await expect(
      warmUpUpload(
        { storage, uploadTokenSecret: SECRET },
        validWarmUpInput({ size: 21 * 1024 * 1024 }),
      ),
    ).rejects.toThrow();
  });

  it("rejects oversized dimensions and non-webp uploads", async () => {
    const { storage } = setup();

    await expect(
      warmUpUpload(
        { storage, uploadTokenSecret: SECRET },
        validWarmUpInput({ width: 13_000 }),
      ),
    ).rejects.toThrow();
    await expect(
      warmUpUpload(
        { storage, uploadTokenSecret: SECRET },
        validWarmUpInput({ contentType: "image/png" }),
      ),
    ).rejects.toThrow();
  });
});

describe("completeUpload", () => {
  async function warmAndStage(sizeOnDisk?: number, checksumOnDisk?: string) {
    const { store, storage } = setup();
    const input = validWarmUpInput();
    const warm = await warmUpUpload(
      { storage, uploadTokenSecret: SECRET },
      input,
    );

    store.setObject("private", `uploads/staging/${warm.uploadId}`, {
      size: sizeOnDisk ?? (input.size as number),
      contentType: "image/webp",
      checksumSha256: checksumOnDisk ?? (input.checksum as string),
    });

    return { store, storage, warm, input };
  }

  it("finalizes a staged upload into the public bucket", async () => {
    const { store, storage, warm } = await warmAndStage();

    const asset = await completeUpload(
      { storage, uploadTokenSecret: SECRET, assetBaseUrl: TEST_ASSET_BASE_URL },
      { uploadId: warm.uploadId, finalizeToken: warm.finalizeToken },
    );

    expect(asset.id).toBe(warm.assetId);
    expect(asset.url).toBe(
      `${TEST_ASSET_BASE_URL}/assets/${warm.assetId}/original.webp`,
    );
    expect(store.has("public", `assets/${warm.assetId}/original.webp`)).toBe(
      true,
    );
    expect(store.has("private", `uploads/staging/${warm.uploadId}`)).toBe(
      false,
    );
  });

  it("is idempotent: retry after finalize returns the same asset", async () => {
    const { storage, warm } = await warmAndStage();
    const deps = {
      storage,
      uploadTokenSecret: SECRET,
      assetBaseUrl: TEST_ASSET_BASE_URL,
    };
    const request = {
      uploadId: warm.uploadId,
      finalizeToken: warm.finalizeToken,
    };

    const first = await completeUpload(deps, request);
    const second = await completeUpload(deps, request);

    expect(second).toEqual(first);
  });

  it("rejects checksum mismatches with INVALID_ASSET", async () => {
    const { storage, warm } = await warmAndStage(
      undefined,
      makeChecksum("different-content"),
    );

    await expectCode(
      completeUpload(
        {
          storage,
          uploadTokenSecret: SECRET,
          assetBaseUrl: TEST_ASSET_BASE_URL,
        },
        { uploadId: warm.uploadId, finalizeToken: warm.finalizeToken },
      ),
      "INVALID_ASSET",
    );
  });

  it("rejects size mismatches with INVALID_ASSET", async () => {
    const { storage, warm } = await warmAndStage(1);

    await expectCode(
      completeUpload(
        {
          storage,
          uploadTokenSecret: SECRET,
          assetBaseUrl: TEST_ASSET_BASE_URL,
        },
        { uploadId: warm.uploadId, finalizeToken: warm.finalizeToken },
      ),
      "INVALID_ASSET",
    );
  });

  it("returns UPLOAD_EXPIRED when the staging object is missing", async () => {
    const { storage } = setup();
    const warm = await warmUpUpload(
      { storage, uploadTokenSecret: SECRET },
      validWarmUpInput(),
    );

    await expectCode(
      completeUpload(
        {
          storage,
          uploadTokenSecret: SECRET,
          assetBaseUrl: TEST_ASSET_BASE_URL,
        },
        { uploadId: warm.uploadId, finalizeToken: warm.finalizeToken },
      ),
      "UPLOAD_EXPIRED",
    );
  });

  it("rejects a finalize token for a different upload", async () => {
    const { storage, warm } = await warmAndStage();
    const other = await warmUpUpload(
      { storage, uploadTokenSecret: SECRET },
      validWarmUpInput(),
    );

    await expectCode(
      completeUpload(
        {
          storage,
          uploadTokenSecret: SECRET,
          assetBaseUrl: TEST_ASSET_BASE_URL,
        },
        { uploadId: warm.uploadId, finalizeToken: other.finalizeToken },
      ),
      "UPLOAD_EXPIRED",
    );
  });
});
