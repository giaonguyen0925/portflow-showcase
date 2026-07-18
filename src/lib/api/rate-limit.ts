type WindowState = {
  windowStartMs: number;
  count: number;
};

const windows = new Map<string, WindowState>();

/**
 * Fixed-window in-memory rate limiter. Per server instance only, which is
 * acceptable for a single-admin V1; swap for a shared store if the write
 * surface ever becomes multi-user.
 */
export function isRateLimited(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  nowMs: number = Date.now(),
): boolean {
  const state = windows.get(key);

  if (!state || nowMs - state.windowStartMs >= windowMs) {
    windows.set(key, { windowStartMs: nowMs, count: 1 });
    return false;
  }

  state.count += 1;
  return state.count > limit;
}

export function resetRateLimits(): void {
  windows.clear();
}
