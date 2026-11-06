import type { QuotaWindow } from "./schemas";

/**
 * What the handbook promises per window, keyed by the window's length in seconds. The docs list
 * larger numbers, but the lower ones are the budget, so a plan can't surprise us.
 */
const HANDBOOK_BUDGET: Record<number, number> = {
  900: 100,
  86_400: 250,
  2_592_000: 3_000,
};

/** Past this share of any window, reads come from the cache and the rest is kept for writes. */
const CACHE_ONLY_SHARE = 0.8;

/** True when any window that hasn't reset yet has used 80% of its budget. */
export function isReadingPaused(windows: readonly QuotaWindow[], now: Date) {
  return windows.some((window) => {
    if (new Date(window.resetsAt) <= now) {
      return false;
    }

    const budget = Math.min(window.quota, HANDBOOK_BUDGET[window.windowSeconds] ?? window.quota);
    // Usage is counted against Buffer's own quota, then judged against the smaller budget.
    const used = window.quota - window.remaining;

    return budget > 0 && used >= budget * CACHE_ONLY_SHARE;
  });
}
