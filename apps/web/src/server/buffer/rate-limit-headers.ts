import type { QuotaWindow } from "@scroll-spark/core/buffer/schemas";

/** `"name"; key=value; key=value`, one item per window, joined by commas when headers merge. */
const ITEM = /"([^"]+)"\s*((?:;\s*[a-z]+\s*=\s*\d+\s*)*)/g;

function itemsOf(header: string | null) {
  const items = new Map<string, Map<string, number>>();

  for (const [, name, rest] of header?.matchAll(ITEM) ?? []) {
    const params = new Map<string, number>();

    for (const [, key, value] of (rest ?? "").matchAll(/([a-z]+)\s*=\s*(\d+)/g)) {
      params.set(String(key), Number(value));
    }

    items.set(String(name), params);
  }

  return items;
}

/**
 * Reads Buffer's `RateLimit` (remaining `r`, seconds to reset `t`) and `RateLimit-Policy` (quota
 * `q`, window seconds `w`). Windows are named by `w`, because plan names change.
 */
export function parseRateLimit(headers: Headers, now: Date): QuotaWindow[] {
  const limits = itemsOf(headers.get("ratelimit"));
  const policies = itemsOf(headers.get("ratelimit-policy"));
  const windows: QuotaWindow[] = [];

  for (const [name, limit] of limits) {
    const policy = policies.get(name);
    const remaining = limit.get("r");
    const secondsToReset = limit.get("t");
    const quota = policy?.get("q");
    const windowSeconds = policy?.get("w");

    if (
      remaining === undefined ||
      secondsToReset === undefined ||
      quota === undefined ||
      windowSeconds === undefined ||
      windowSeconds <= 0
    ) {
      continue;
    }

    windows.push({
      windowSeconds,
      quota,
      remaining: Math.min(remaining, quota),
      resetsAt: new Date(now.getTime() + secondsToReset * 1000).toISOString(),
    });
  }

  return windows;
}
