/** Fields are IDs, codes and timings. Tokens and post text stay out of logs. */
export type LogFields = Record<string, string | number | boolean | null>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}
