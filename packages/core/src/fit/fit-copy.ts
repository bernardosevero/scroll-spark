import type { ChannelFit, Duplicates } from "./schemas";

export interface FitCopy {
  channel: string;
  /** "fits" and "new" are answers. "unclear" is for a channel we can't judge. */
  verdict: "fits" | "new" | "unclear";
  detail: string;
}

export interface CopyOptions {
  now: Date;
  /** An IANA zone. Leave it out to use the reader's own. */
  timeZone?: string;
}

function plural(count: number, noun: string) {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/** The real date, with the year once it isn't this year's, so an old post can't pass as recent. */
export function formatPostDate(iso: string, { now, timeZone }: CopyOptions) {
  const date = new Date(iso);
  const year = (value: Date) =>
    new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: year(date) === year(now) ? undefined : "numeric",
    timeZone,
  }).format(date);
}

function fitsDetail(fit: ChannelFit, options: CopyOptions) {
  const parts = [
    ...(fit.clusterName === null ? [] : [fit.clusterName]),
    plural(fit.matchingPosts, "post"),
    ...(fit.lastPostedAt === null
      ? []
      : [`last posted ${formatPostDate(fit.lastPostedAt, options)}`]),
    ...(fit.nextScheduledAt === null
      ? []
      : [`next scheduled ${formatPostDate(fit.nextScheduledAt, options)}`]),
  ];

  return parts.join(", ");
}

function thinDetail({ usablePosts, readPosts }: ChannelFit) {
  if (readPosts === 0) {
    return "No posts on this channel yet, so we can't compare.";
  }

  if (readPosts > usablePosts) {
    return `Only ${String(usablePosts)} of ${String(readPosts)} posts on this channel have enough text to compare, so we can't compare yet.`;
  }

  return `Only ${plural(usablePosts, "post")} on this channel so far, so we can't compare yet.`;
}

/** Counts and dates only. Nothing here says how a post will do, because we can't know that. */
export function describeChannelFit(fit: ChannelFit, options: CopyOptions): FitCopy {
  const channel = fit.channelName;

  switch (fit.state) {
    case "fits":
      return { channel, verdict: "fits", detail: fitsDetail(fit, options) };
    case "new":
      return {
        channel,
        verdict: "new",
        detail:
          `None of your ${String(fit.usablePosts)} posts here cover this.` +
          (fit.clusterName === null ? "" : ` New group idea: ${fit.clusterName}`),
      };
    case "thin":
      return { channel, verdict: "unclear", detail: thinDetail(fit) };
    case "unavailable":
      return {
        channel,
        verdict: "unclear",
        detail: "We couldn't check this channel this time, so there's no fit for it yet.",
      };
  }
}

/** The duplicate check, or null when there's nothing to say. */
export function describeDuplicates({ ideas, queuedPosts }: Duplicates): string | null {
  const parts = [
    ...(ideas === null || ideas === 0 ? [] : [plural(ideas, "idea")]),
    ...(queuedPosts === 0 ? [] : [`${plural(queuedPosts, "queued post")}`]),
  ];

  return parts.length === 0 ? null : `You already have ${parts.join(" and ")} on this.`;
}
