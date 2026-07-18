/**
 * Public app URL, safe to read on both server and client.
 * `NEXT_PUBLIC_*` values are inlined into the client bundle at build time.
 */
export function getPublicAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
