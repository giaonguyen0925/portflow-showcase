import path from "node:path";

import type { NextConfig } from "next";

// DEV_ADMIN_BYPASS must never leave local development. `next build` and
// `next start` run with NODE_ENV=production, so this fails the build/boot
// on Preview and Production before any request is served.
if (
  process.env.DEV_ADMIN_BYPASS === "true" &&
  process.env.NODE_ENV !== "development"
) {
  throw new Error(
    "DEV_ADMIN_BYPASS=true is only allowed in local development. Remove it from this environment.",
  );
}

const isDevelopment = process.env.NODE_ENV === "development";
const assetBaseUrl = process.env.R2_PUBLIC_BASE_URL ?? "";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; dev mode additionally needs eval.
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${assetBaseUrl ? ` ${assetBaseUrl}` : ""}`,
  "font-src 'self' data:",
  // Direct-to-R2 uploads PUT to the account's storage endpoint.
  "connect-src 'self' https://*.r2.cloudflarestorage.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // A lockfile in a parent directory makes Next.js misdetect the workspace
  // root; pin it to this package.
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
