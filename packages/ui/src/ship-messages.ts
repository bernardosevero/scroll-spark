/** The one user-facing message for each expected failure while saving, drafting or posting. */

const SERVICE_NAMES: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "X",
  x: "X",
  threads: "Threads",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  instagram: "Instagram",
};

const LANGUAGE_LABELS: Record<string, string> = {
  same: "Same as my recent posts",
  english: "English",
  portuguese: "Portuguese",
  spanish: "Spanish",
  french: "French",
  german: "German",
};

/** The words for a draft language, as the editor's switch shows them. */
export function languageLabel(language: string) {
  return LANGUAGE_LABELS[language] ?? language;
}

export function serviceName(service: string) {
  return SERVICE_NAMES[service.toLowerCase()] ?? service;
}

export function ideaFailureMessage(code: string | null) {
  switch (code) {
    case "BUFFER_LIMIT_REACHED":
      return "Your Buffer plan has reached its limit for Ideas, so Buffer wouldn't take this one. Make room in Buffer, then try again.";
    case "BUFFER_RATE_LIMITED":
      return "Buffer is busy right now. Give it a few minutes, then try again.";
    case "RECONNECT_REQUIRED":
      return "Buffer needs you to connect again before this can be saved.";
    case "INVALID_INPUT":
      return "Choose your Buffer organization on the Channels page first, then save this.";
    default:
      return "That didn't save. Your capture is safe, so you can try again. Check Buffer Ideas first if you want to be sure it didn't go through.";
  }
}

export function draftFailureMessage(code: string | null) {
  switch (code) {
    case "LLM_REFUSED":
      return "We couldn't write a draft for this one. Your capture and anything you typed are safe, so you can write your own below.";
    case "DRAFT_LIMIT_REACHED":
      return "That's today's draft limit reached. Your capture is safe, and you can write your own post below.";
    case "BUFFER_RATE_LIMITED":
      return "Buffer is busy, so we couldn't read your recent posts. Give it a few minutes, then try again.";
    case "RECONNECT_REQUIRED":
      return "Buffer needs you to connect again before we can read your recent posts.";
    case "CHANNEL_NOT_SUPPORTED":
      return "That channel can't be posted to from here yet. Pick another one.";
    default:
      return "That didn't work this time. Anything you typed is safe, so you can try again.";
  }
}

export function postFailureMessage(code: string | null, kind: "draft" | "queue") {
  switch (code) {
    case "BUFFER_LIMIT_REACHED":
      return "Your Buffer plan has reached its limit for posts, so Buffer wouldn't take this one. Make room in Buffer, then try again. Your text is still here.";
    case "BUFFER_RATE_LIMITED":
      return "Buffer is busy right now. Your text is still here, so try again in a few minutes.";
    case "RECONNECT_REQUIRED":
      return "Buffer needs you to connect again. Your text is still here.";
    case "POST_TOO_LONG":
      return "That's over this channel's limit. Shorten it and try again.";
    case "CHANNEL_NOT_SUPPORTED":
      return "That channel can't be posted to from here yet. Pick another one. Your text is still here.";
    case "INVALID_INPUT":
      return kind === "queue"
        ? "Buffer wouldn't add this to the queue. If this channel has no posting times set, add some in Buffer, or save it as a draft instead. Your text is still here."
        : "Buffer wouldn't take this. Your text is still here.";
    default:
      // Nothing was retried, so the post may or may not have reached Buffer.
      return "We couldn't confirm this reached Buffer, and we haven't tried again. Check Buffer before you try again, so it isn't posted twice. Your text is still here.";
  }
}

export function analysisFailureMessage(code: string | null) {
  switch (code) {
    case "LLM_REFUSED":
      return "We couldn't analyze this one. Your capture is safe in your inbox.";
    case "ANALYSIS_LIMIT_REACHED":
      return "That's today's limit reached. Your capture is safe, so come back tomorrow.";
    case "BUFFER_RATE_LIMITED":
      return "Buffer is busy, so we couldn't check your channels. Your capture is safe, so try again in a few minutes.";
    case "RECONNECT_REQUIRED":
      return "Buffer needs you to connect again before we can check your channels. Your capture is safe.";
    default:
      return "That didn't work this time. Your capture is safe, so you can try again.";
  }
}

const MIN_SAMPLES = 3;

/** What the draft was written from, in words. Counts only. */
export function voiceNote({ sampleCount, isMatched }: { sampleCount: number; isMatched: boolean }) {
  if (isMatched) {
    return `Written from your last ${String(sampleCount)} posts on this channel.`;
  }

  const found =
    sampleCount === 0
      ? "no usable posts"
      : `only ${String(sampleCount)} usable post${sampleCount === 1 ? "" : "s"}`;

  return `We found ${found} on this channel, and a draft needs ${String(MIN_SAMPLES)} to sound like you. This one is in a plain voice, so make it yours.`;
}
