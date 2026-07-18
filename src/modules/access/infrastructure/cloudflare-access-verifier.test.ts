import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/app-error";
import { isAllowedAdminEmail } from "@/modules/access/application/admin-email";

import { verifyAccessJwt } from "./cloudflare-access-verifier";

const TEAM_DOMAIN = "team-name.cloudflareaccess.com";
const AUD = "test-audience-tag";
const OPTIONS = {
  teamDomain: TEAM_DOMAIN,
  allowedAuds: new Set([AUD, "second-aud"]),
};

let privateKey: CryptoKey;
let getKey: JWTVerifyGetKey;
let wrongGetKey: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  getKey = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), alg: "RS256", use: "sig" }],
  });

  const otherPair = await generateKeyPair("RS256");
  wrongGetKey = createLocalJWKSet({
    keys: [
      { ...(await exportJWK(otherPair.publicKey)), alg: "RS256", use: "sig" },
    ],
  });
});

function makeToken(overrides: {
  issuer?: string;
  audience?: string;
  email?: string | undefined;
  expiresIn?: string;
}): Promise<string> {
  const jwt = new SignJWT(
    overrides.email === undefined ? {} : { email: overrides.email },
  )
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(overrides.issuer ?? `https://${TEAM_DOMAIN}`)
    .setAudience(overrides.audience ?? AUD)
    .setExpirationTime(overrides.expiresIn ?? "5m");

  return jwt.sign(privateKey);
}

async function expectUnauthenticated(promise: Promise<unknown>) {
  try {
    await promise;
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("UNAUTHENTICATED");
  }
}

describe("verifyAccessJwt", () => {
  it("accepts a valid token and normalizes the email", async () => {
    const token = await makeToken({ email: " Owner@Example.COM " });

    const identity = await verifyAccessJwt(token, OPTIONS, getKey);

    expect(identity.email).toBe("owner@example.com");
  });

  it("rejects a token with a wrong issuer", async () => {
    const token = await makeToken({
      issuer: "https://evil.example.com",
      email: "owner@example.com",
    });

    await expectUnauthenticated(verifyAccessJwt(token, OPTIONS, getKey));
  });

  it("rejects a token with an unknown audience", async () => {
    const token = await makeToken({
      audience: "not-our-application",
      email: "owner@example.com",
    });

    await expectUnauthenticated(verifyAccessJwt(token, OPTIONS, getKey));
  });

  it("rejects an expired token", async () => {
    const token = await makeToken({
      email: "owner@example.com",
      expiresIn: "-5m",
    });

    await expectUnauthenticated(verifyAccessJwt(token, OPTIONS, getKey));
  });

  it("rejects a token signed by an unknown key", async () => {
    const token = await makeToken({ email: "owner@example.com" });

    await expectUnauthenticated(verifyAccessJwt(token, OPTIONS, wrongGetKey));
  });

  it("rejects a token without an email claim", async () => {
    const token = await makeToken({ email: undefined });

    await expectUnauthenticated(verifyAccessJwt(token, OPTIONS, getKey));
  });

  it("rejects garbage tokens", async () => {
    await expectUnauthenticated(
      verifyAccessJwt("not.a.jwt", OPTIONS, getKey),
    );
  });
});

describe("isAllowedAdminEmail", () => {
  it("compares emails exactly after trim and lowercase", () => {
    expect(isAllowedAdminEmail("Owner@Example.com ", "owner@example.com")).toBe(
      true,
    );
    expect(isAllowedAdminEmail("other@example.com", "owner@example.com")).toBe(
      false,
    );
    expect(
      isAllowedAdminEmail("owner@example.com.evil.com", "owner@example.com"),
    ).toBe(false);
  });
});
