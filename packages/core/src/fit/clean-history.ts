import type { BufferPost } from "../buffer/schemas";

/** Posts shorter than this say too little to place in a topic. */
export const MIN_POST_LENGTH = 80;

/** Only the start of a post is read, since a YouTube description can be mostly credits. */
export const MAX_POST_LENGTH = 500;

/** A sent or scheduled post with text and a real date. */
export interface HistoryPost {
  id: string;
  channelId: string;
  text: string;
  status: "sent" | "scheduled";
  /** When it was sent, or when it's due. Always the real date, so old posts can't pass as new. */
  postedAt: string;
}

/** One post after cleaning, standing for every copy of it. */
export interface CleanedPost {
  /** The newest copy's ID. */
  id: string;
  channelId: string;
  /** At most `MAX_POST_LENGTH` characters. */
  text: string;
  /** The newest copy's date. */
  postedAt: string;
  /** The newest copy that was sent, or null if none was. */
  lastSentAt: string | null;
  /** The soonest copy that is scheduled, or null if none is. */
  scheduledAt: string | null;
  /** The other copies that were folded into this one, newest first. */
  mergedPostIds: string[];
}

/**
 * Keeps the posts that were sent or scheduled and have text and a date. Statuses are Buffer's, and
 * stay unconfirmed until #2 records real responses.
 */
export function historyPostsOf(posts: readonly BufferPost[]): HistoryPost[] {
  const history: HistoryPost[] = [];

  for (const post of posts) {
    const status = post.status.toLowerCase();
    const text = post.text?.trim() ?? "";
    const date = status === "sent" ? (post.sentAt ?? post.dueAt) : post.dueAt;
    const time = date === null || date === undefined ? Number.NaN : Date.parse(date);

    if ((status === "sent" || status === "scheduled") && text !== "" && !Number.isNaN(time)) {
      history.push({
        id: post.id,
        channelId: post.channelId,
        text,
        status,
        postedAt: new Date(time).toISOString(),
      });
    }
  }

  return history;
}

function cut(text: string) {
  return [...text].slice(0, MAX_POST_LENGTH).join("").trimEnd();
}

/** Two copies of a post differ in links, hashtags and spacing, so only the words are compared. */
function sameness(text: string) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function byNewest(a: HistoryPost, b: HistoryPost) {
  return b.postedAt.localeCompare(a.postedAt) || a.id.localeCompare(b.id);
}

/**
 * Cleans a history before anything reads it:
 * 1. posts under `MIN_POST_LENGTH` characters are ignored
 * 2. duplicate cross-posts are merged into one, whichever channels they were on
 * 3. text is cut to its first `MAX_POST_LENGTH` characters
 *
 * There is no date cutoff. The result is newest first and keeps every real date.
 */
export function cleanHistory(posts: readonly HistoryPost[]): CleanedPost[] {
  const groups = new Map<string, HistoryPost[]>();

  for (const post of [...posts].sort(byNewest)) {
    const text = cut(post.text.trim());

    if ([...post.text.trim()].length < MIN_POST_LENGTH) {
      continue;
    }

    // Text with no words in it can't be told apart from another, so it never merges.
    const key = sameness(text) || `id:${post.id}`;
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }

  const cleaned: CleanedPost[] = [];

  for (const [newest, ...others] of groups.values()) {
    if (newest === undefined) {
      continue;
    }

    const copies = [newest, ...others];
    const dates = (status: HistoryPost["status"]) =>
      copies.filter((copy) => copy.status === status).map((copy) => copy.postedAt);

    cleaned.push({
      id: newest.id,
      channelId: newest.channelId,
      text: cut(newest.text.trim()),
      postedAt: newest.postedAt,
      lastSentAt: dates("sent").sort().at(-1) ?? null,
      scheduledAt: dates("scheduled").sort()[0] ?? null,
      mergedPostIds: others.map((copy) => copy.id),
    });
  }

  return cleaned;
}
