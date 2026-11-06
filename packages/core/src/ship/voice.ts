import type { BufferPost } from "../buffer/schemas";

/** Posts shorter than this say too little about how someone writes. */
const MIN_SAMPLE_LENGTH = 80;
const MAX_SAMPLE_LENGTH = 500;
const MAX_VOICE_SAMPLES = 8;
/** Fewer usable posts than this and a draft can't honestly claim to sound like the user. */
export const MIN_VOICE_SAMPLES = 3;

function postedAt(post: BufferPost) {
  const time = Date.parse(post.sentAt ?? post.dueAt ?? "");

  return Number.isNaN(time) ? 0 : time;
}

function isSent(post: BufferPost) {
  return post.sentAt != null || post.status.toLowerCase() === "sent";
}

/**
 * Picks the posts a draft learns the user's voice from: the newest sent ones that say enough,
 * each cut to its first 500 characters, up to 8, newest first.
 *
 * This is a small stand-in. The fit check (#7) cleans a channel's history more carefully, and
 * this should call that once it exists. Statuses are Buffer's, and "sent" is unconfirmed (#2).
 */
export function pickVoiceSamples(posts: BufferPost[]): string[] {
  return posts
    .filter(isSent)
    .sort((a, b) => postedAt(b) - postedAt(a))
    .map((post) =>
      Array.from((post.text ?? "").trim())
        .slice(0, MAX_SAMPLE_LENGTH)
        .join(""),
    )
    .filter((text) => Array.from(text).length >= MIN_SAMPLE_LENGTH)
    .slice(0, MAX_VOICE_SAMPLES);
}
