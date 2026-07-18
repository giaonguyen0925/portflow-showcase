import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { AppError } from "@/lib/api/app-error";

export const FINALIZE_TOKEN_TTL_MS = 15 * 60 * 1000;

const finalizeTokenPayloadSchema = z.object({
  uploadId: z.string().regex(/^upload_[a-f0-9]{32}$/),
  assetId: z.string().regex(/^asset_[a-f0-9]{32}$/),
  stagingKey: z.string().min(1),
  checksum: z.string().min(1),
  size: z.number().int().min(1),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  contentType: z.literal("image/webp"),
  expiresAt: z.iso.datetime(),
});

export type FinalizeTokenPayload = z.infer<typeof finalizeTokenPayloadSchema>;

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function signFinalizeToken(
  payload: FinalizeTokenPayload,
  secret: string,
): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(secret, encoded).toString("base64url");
  return `${encoded}.${signature}`;
}

export function verifyFinalizeToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): FinalizeTokenPayload {
  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    throw new AppError("UPLOAD_EXPIRED", "Finalize token is malformed");
  }

  const expected = hmac(secret, encoded);
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    throw new AppError("UPLOAD_EXPIRED", "Finalize token is malformed");
  }

  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    throw new AppError("UPLOAD_EXPIRED", "Finalize token signature is invalid");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new AppError("UPLOAD_EXPIRED", "Finalize token is malformed");
  }

  const result = finalizeTokenPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError("UPLOAD_EXPIRED", "Finalize token is malformed");
  }

  if (new Date(result.data.expiresAt).getTime() <= now.getTime()) {
    throw new AppError("UPLOAD_EXPIRED", "Upload finalize window has expired");
  }

  return result.data;
}
