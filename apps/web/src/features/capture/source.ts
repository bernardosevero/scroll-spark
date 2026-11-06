/** A readable name for a link: who it's from when known, otherwise its site. */
export function sourceLabel({ url, name }: { url: string; name: string | null }) {
  return name ?? new URL(url).hostname.replace(/^www\./, "");
}
