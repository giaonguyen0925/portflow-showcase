import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/app-error";
import { makeChecksum } from "@/test/fixtures/assets";

import {
  signFinalizeToken,
  verifyFinalizeToken,
  type FinalizeTokenPayload,
} from "./finalize-token";

const SECRET = "0123456789abcdef0123456789abcdef";

function makePayload(expiresAt: string): FinalizeTokenPayload {
  return {
    uploadId: `upload_${"a".repeat(32)}`,
    assetId: `asset_${"b".repeat(32)}`,
    stagingKey: `uploads/staging/upload_${"a".repeat(32)}`,
    checksum: makeChecksum(),
    size: 1024,
    width: 800,
    height: 600,
    contentType: "image/webp",
    expiresAt,
  };
}

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

describe("finalize token", () => {
  it("round-trips a valid token", () => {
    const payload = makePayload(inMinutes(10));
    const token = signFinalizeToken(payload, SECRET);

    expect(verifyFinalizeToken(token, SECRET)).toEqual(payload);
  });

  it("rejects an expired token with UPLOAD_EXPIRED", () => {
    const token = signFinalizeToken(makePayload(inMinutes(-1)), SECRET);

    try {
      verifyFinalizeToken(token, SECRET);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("UPLOAD_EXPIRED");
    }
  });

  it("rejects a token signed with a different secret", () => {
    const token = signFinalizeToken(makePayload(inMinutes(10)), SECRET);

    expect(() => verifyFinalizeToken(token, "another-secret-value-01234567890")).toThrow(
      AppError,
    );
  });

  it("rejects a tampered payload", () => {
    const token = signFinalizeToken(makePayload(inMinutes(10)), SECRET);
    const [encoded, signature] = token.split(".") as [string, string];
    const tampered = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as FinalizeTokenPayload;
    tampered.size = 999_999;
    const forged = `${Buffer.from(JSON.stringify(tampered)).toString("base64url")}.${signature}`;

    expect(() => verifyFinalizeToken(forged, SECRET)).toThrow(AppError);
  });

  it("rejects malformed tokens", () => {
    expect(() => verifyFinalizeToken("not-a-token", SECRET)).toThrow(AppError);
    expect(() => verifyFinalizeToken("a.b.c", SECRET)).toThrow(AppError);
    expect(() => verifyFinalizeToken("", SECRET)).toThrow(AppError);
  });
});
