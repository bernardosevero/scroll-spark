/**
 * The most characters a post may hold, by Buffer's service name. Starting values from the issue,
 * to be checked against Buffer and each platform's own docs:
 * LinkedIn 3,000, X 280 (accounts with a paid plan can write more), Threads 500, Bluesky 300,
 * Mastodon 500 (the default, which instances can change).
 * A channel on a service not listed here has no limit we can enforce, so Buffer decides.
 */
const LIMITS: Record<string, number> = {
  linkedin: 3000,
  twitter: 280,
  x: 280,
  threads: 500,
  bluesky: 300,
  mastodon: 500,
};

export function characterLimitFor(service: string): number | null {
  return LIMITS[service.toLowerCase()] ?? null;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Counts what a reader sees as one character, so an emoji is one. Platforms count slightly
 * differently (X weights links and some scripts), so the editor's count is a close guide.
 */
export function countCharacters(text: string): number {
  return Array.from(segmenter.segment(text)).length;
}
