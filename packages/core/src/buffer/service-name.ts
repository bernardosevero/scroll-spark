const SERVICE_NAMES: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "X",
  x: "X",
  threads: "Threads",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  substack: "Substack",
};

/** Buffer's service value, like "linkedin", as people write it. */
export function serviceLabel(service: string) {
  return SERVICE_NAMES[service.toLowerCase()] ?? service;
}
