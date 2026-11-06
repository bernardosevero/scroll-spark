import type { LinkPreview } from "@scroll-spark/core/capture/capture.service";

const MAX_TAG_LENGTH = 8_192;
const ATTRIBUTE = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string) {
  return text.replace(/&(#x?[\da-f]+|\w+);/gi, (entity, code: string) => {
    if (!code.startsWith("#")) {
      return ENTITIES[code.toLowerCase()] ?? entity;
    }

    const isHex = code[1]?.toLowerCase() === "x";
    const value = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
  });
}

function clean(text: string | undefined) {
  const cleaned = decodeEntities(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned === "" ? null : cleaned;
}

/** Scans by hand rather than with one big pattern, so a hostile page can't make a regex crawl. */
function readMetaTags(html: string) {
  const tags = new Map<string, string>();
  let position = html.search(/<meta\b/i);

  while (position !== -1) {
    const end = html.indexOf(">", position);
    if (end === -1) {
      break;
    }

    if (end - position <= MAX_TAG_LENGTH) {
      const attributes = new Map(
        Array.from(html.slice(position, end).matchAll(ATTRIBUTE), ([, name, double, single]) => [
          name?.toLowerCase(),
          double ?? single ?? "",
        ]),
      );
      const key = (attributes.get("property") ?? attributes.get("name"))?.toLowerCase();
      const content = attributes.get("content");

      if (key !== undefined && content !== undefined && !tags.has(key)) {
        tags.set(key, content);
      }
    }

    const next = html.slice(end).search(/<meta\b/i);
    position = next === -1 ? -1 : end + next;
  }

  return tags;
}

function readTitle(html: string) {
  const start = html.search(/<title\b/i);
  const open = start === -1 ? -1 : html.indexOf(">", start);
  const close = open === -1 ? -1 : html.toLowerCase().indexOf("</title", open);

  return close === -1 ? undefined : html.slice(open + 1, close);
}

export function parsePageMeta(html: string): LinkPreview {
  const tags = readMetaTags(html);

  return {
    title: clean(tags.get("og:title") ?? readTitle(html)),
    description: clean(tags.get("og:description") ?? tags.get("description")),
    sourceName: clean(tags.get("og:site_name")),
  };
}
