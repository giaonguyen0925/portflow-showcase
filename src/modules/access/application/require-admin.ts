import "server-only";

import { headers } from "next/headers";

import { AppError } from "@/lib/api/app-error";
import { getServerEnv } from "@/lib/env/server";
import { verifyAccessJwt } from "@/modules/access/infrastructure/cloudflare-access-verifier";

import { isAllowedAdminEmail } from "./admin-email";

export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

export type AdminIdentity = {
  email: string;
  method: "cloudflare-access" | "dev-bypass";
};

/**
 * Application-layer admin gate for every admin page and write API.
 * Cloudflare Access is the login screen, but requests can reach the origin
 * directly (e.g. via the *.vercel.app domain), so the JWT is always
 * re-verified here.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const env = getServerEnv();

  if (env.DEV_ADMIN_BYPASS && env.NODE_ENV === "development") {
    return { email: env.ADMIN_EMAIL, method: "dev-bypass" };
  }

  const headerList = await headers();
  const token = headerList.get(ACCESS_JWT_HEADER);

  if (!token) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Missing Cloudflare Access token",
    );
  }

  const { email } = await verifyAccessJwt(token, {
    teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
    allowedAuds: env.CF_ACCESS_AUDS,
  });

  if (!isAllowedAdminEmail(email, env.ADMIN_EMAIL)) {
    throw new AppError("FORBIDDEN", "This account is not the site admin");
  }

  return { email, method: "cloudflare-access" };
}
