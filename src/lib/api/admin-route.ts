import "server-only";

import { ZodError } from "zod";

import {
  AppError,
  isAppError,
  type ApiError,
} from "@/lib/api/app-error";
import { isRateLimited } from "@/lib/api/rate-limit";
import { logServerEvent } from "@/lib/observability/logger";
import {
  requireAdmin,
  type AdminIdentity,
} from "@/modules/access/application/require-admin";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  if (error instanceof ZodError) {
    return new AppError("VALIDATION_ERROR", "Request payload is invalid", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  if (error instanceof SyntaxError) {
    return new AppError("VALIDATION_ERROR", "Request body is not valid JSON");
  }
  return new AppError("INTERNAL_ERROR", "Unexpected server error");
}

type AdminRouteArgs<P> = {
  request: Request;
  params: P;
  admin: AdminIdentity;
  requestId: string;
};

type AdminRouteOptions = {
  rateLimit?: { limit: number; windowMs: number };
};

const DEFAULT_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

/**
 * Shared shell for every /api/admin route: requireAdmin() first, then rate
 * limiting, then the handler; all failures map to the ARD §14.1 error
 * contract with a requestId and structured log line.
 */
export function createAdminRoute<P = Record<string, never>>(
  operation: string,
  handler: (args: AdminRouteArgs<P>) => Promise<Response>,
  options?: AdminRouteOptions,
) {
  return async (
    request: Request,
    context?: { params: Promise<P> },
  ): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();

    try {
      const admin = await requireAdmin();

      const rateLimit = options?.rateLimit ?? DEFAULT_RATE_LIMIT;
      if (isRateLimited(`${operation}:${admin.email}`, rateLimit)) {
        throw new AppError("RATE_LIMITED", "Too many requests, slow down");
      }

      const params = context ? await context.params : ({} as P);
      const response = await handler({ request, params, admin, requestId });

      logServerEvent("info", operation, {
        requestId,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });

      return response;
    } catch (error) {
      const appError = toAppError(error);

      logServerEvent(appError.status >= 500 ? "error" : "warn", operation, {
        requestId,
        code: appError.code,
        status: appError.status,
        durationMs: Date.now() - startedAt,
      });

      const body: ApiError = {
        error: {
          code: appError.code,
          message: appError.message,
          requestId,
          ...(appError.details === undefined
            ? {}
            : { details: appError.details }),
        },
      };

      return Response.json(body, { status: appError.status, headers: NO_STORE });
    }
  };
}
