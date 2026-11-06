/** Every failure the product expects. Each code has one user message, in the UI's message table. */
export const APP_ERROR_CODES = [
  "INVALID_INPUT",
  "OAUTH_FAILED",
  "RECONNECT_REQUIRED",
  "BUFFER_RATE_LIMITED",
  "BUFFER_LIMIT_REACHED",
  "LLM_REFUSED",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "AppError";
    this.code = code;
  }
}
