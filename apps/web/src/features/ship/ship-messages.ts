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
