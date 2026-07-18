import "server-only";

import { parseServerEnv, type ServerEnv } from "./schema";

let cachedEnv: ServerEnv | undefined;

/**
 * Parses and caches server environment variables on first use so that
 * `next build` succeeds without real secrets; misconfiguration fails
 * at startup instead.
 */
export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
