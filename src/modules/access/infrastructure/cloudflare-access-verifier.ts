import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

import { AppError, isAppError } from "@/lib/api/app-error";

export type AccessVerifyOptions = {
  teamDomain: string;
  allowedAuds: ReadonlySet<string>;
};

export type VerifiedAccessIdentity = {
  email: string;
};

const remoteJwksCache = new Map<string, JWTVerifyGetKey>();

function getRemoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = remoteJwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
    );
    remoteJwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Verifies a Cloudflare Access JWT: signature against the team JWKS,
 * issuer, audience, expiry, and presence of an email claim. `getKey` is
 * injectable so tests can use a local key set.
 */
export async function verifyAccessJwt(
  token: string,
  options: AccessVerifyOptions,
  getKey: JWTVerifyGetKey = getRemoteJwks(options.teamDomain),
): Promise<VerifiedAccessIdentity> {
  try {
    const { payload } = await jwtVerify(token, getKey, {
      issuer: `https://${options.teamDomain}`,
      audience: [...options.allowedAuds],
    });

    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";

    if (!email) {
      throw new AppError(
        "UNAUTHENTICATED",
        "Access token does not carry an email identity",
      );
    }

    return { email };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw new AppError("UNAUTHENTICATED", "Access token is invalid");
  }
}
