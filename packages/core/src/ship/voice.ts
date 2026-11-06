import type { BufferPost } from "../buffer/schemas";
import { cleanHistory, historyPostsOf } from "../fit/clean-history";

const MAX_VOICE_SAMPLES = 8;
/** Fewer usable posts than this and a draft can't honestly claim to sound like the user. */
export const MIN_VOICE_SAMPLES = 3;

/**
 * Picks the posts a draft learns the user's voice from, using the same cleaning as the fit check:
 * the newest sent ones that say enough, with cross-posts merged, up to 8. Scheduled posts haven't
 * gone out yet, so they don't count.
 */
export function pickVoiceSamples(posts: readonly BufferPost[]): string[] {
  return cleanHistory(historyPostsOf(posts))
    .filter(({ lastSentAt }) => lastSentAt !== null)
    .slice(0, MAX_VOICE_SAMPLES)
    .map(({ text }) => text);
}
