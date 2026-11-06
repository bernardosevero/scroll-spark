import { MAX_CAPTURE_LENGTH } from "./limits";
import type {
  Capture,
  CapturePlatform,
  CreateCaptureInput,
  ReadLinkInput,
  ReadLinkResult,
} from "./schemas";

const INBOX_SIZE = 50;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

export type NewCapture = CreateCaptureInput & { userId: string };

export interface CaptureRepository {
  insert(capture: NewCapture): Promise<Capture>;
  /** Only this user's captures, newest first. */
  listNewest(userId: string, limit: number): Promise<Capture[]>;
}

export interface LinkPreview {
  title: string | null;
  description: string | null;
  sourceName: string | null;
}

/** Each returns null for any failure, so callers can't tell a refused host from a missing page. */
export interface LinkReader {
  readYouTube(url: string): Promise<LinkPreview | null>;
  readPage(url: string): Promise<LinkPreview | null>;
}

export interface CaptureService {
  readLink(input: ReadLinkInput): Promise<ReadLinkResult>;
  create(userId: string, input: CreateCaptureInput): Promise<Capture>;
  listInbox(userId: string): Promise<Capture[]>;
}

/** Counts code points, so an emoji is never cut in half. */
function cutToLimit(text: string) {
  return Array.from(text.trim()).slice(0, MAX_CAPTURE_LENGTH).join("").trimEnd();
}

function platformOf(url: string): CapturePlatform {
  const host = new URL(url).hostname.toLowerCase();

  if (host === "lnkd.in" || host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    return "linkedin";
  }

  return YOUTUBE_HOSTS.has(host) ? "youtube" : "web";
}

function textOf({ title, description }: LinkPreview) {
  return [title, description]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function createCaptureService({
  captures,
  linkReader,
}: {
  captures: CaptureRepository;
  linkReader: LinkReader;
}): CaptureService {
  return {
    async readLink({ url }) {
      const platform = platformOf(url);

      // LinkedIn hides its posts from servers, so don't spend a request finding out again.
      if (platform === "linkedin") {
        return { status: "paste_needed", url, platform };
      }

      const preview =
        platform === "youtube" ? await linkReader.readYouTube(url) : await linkReader.readPage(url);
      const text = preview === null ? "" : textOf(preview);

      return preview === null || text === ""
        ? { status: "paste_needed", url, platform }
        : {
            status: "found",
            url,
            platform,
            text: cutToLimit(text),
            sourceName: preview.sourceName,
          };
    },

    create(userId, input) {
      return captures.insert({ ...input, userId, text: cutToLimit(input.text) });
    },

    listInbox(userId) {
      return captures.listNewest(userId, INBOX_SIZE);
    },
  };
}
