import type { LogFields, Logger } from "@scroll-spark/core/logging/logger";

const LEVELS = ["info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

/** One JSON line per event, so Vercel's logs stay searchable. */
export function createLogger({ level }: { level: Level }): Logger {
  function write(eventLevel: Level, event: string, fields: LogFields = {}) {
    if (LEVELS.indexOf(eventLevel) < LEVELS.indexOf(level)) {
      return;
    }

    console[eventLevel](JSON.stringify({ level: eventLevel, event, ...fields }));
  }

  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}
