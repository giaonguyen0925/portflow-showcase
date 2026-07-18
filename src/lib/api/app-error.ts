export const API_ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  PROJECT_NOT_FOUND: 404,
  PROJECT_NAME_CONFLICT: 409,
  PROJECT_SLUG_CONFLICT: 409,
  REVISION_CONFLICT: 409,
  UPLOAD_EXPIRED: 410,
  INVALID_ASSET: 422,
  RATE_LIMITED: 429,
  STORAGE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

export type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
};

/**
 * Typed application error carried from domain/application layers to the
 * HTTP boundary. Messages must be safe to show to the client.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = API_ERROR_STATUS[code];
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
