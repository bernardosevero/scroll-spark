/** Every failure the product expects. Each code has one user message, in the UI's message table. */
export const APP_ERROR_CODES = [
  "INVALID_INPUT",
  "OAUTH_FAILED",
  "NOT_SIGNED_IN",
  "NOT_FOUND",
  "ANALYSIS_LIMIT_REACHED",
  "LLM_FAILED",
  "RECONNECT_REQUIRED",
  "BUFFER_RATE_LIMITED",
  "BUFFER_LIMIT_REACHED",
  "LLM_REFUSED",
  "BUFFER_FAILED",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: AppErrorCode;

  /** Seconds Buffer asked us to wait, on a rate limit. Null when it didn't say. */
  readonly retryAfterSeconds: number | null;

  constructor(code: AppErrorCode, options?: ErrorOptions & { retryAfterSeconds?: number }) {
    super(code, options);
    this.name = "AppError";
    this.code = code;
    this.retryAfterSeconds = options?.retryAfterSeconds ?? null;
  }
}
