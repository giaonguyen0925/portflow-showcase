export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Fetch wrapper for the admin API that unwraps the ARD §14.1 error contract. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    let code = "INTERNAL_ERROR";
    let message = `Request failed with status ${response.status}`;
    let details: Record<string, unknown> | undefined;

    try {
      const body = (await response.json()) as {
        error?: {
          code?: string;
          message?: string;
          details?: Record<string, unknown>;
        };
      };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      details = body.error?.details;
    } catch {
      // Non-JSON error body; keep defaults.
    }

    throw new ApiClientError(code, message, response.status, details);
  }

  return (await response.json()) as T;
}

/**
 * Serializes saves per resource across tabs via the Web Locks API
 * (ARD §19); falls back to running directly where unsupported.
 */
export async function withResourceLock<T>(
  resource: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    return navigator.locks.request(`portflow:${resource}`, fn) as Promise<T>;
  }
  return fn();
}
