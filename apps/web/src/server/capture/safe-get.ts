import { lookup } from "node:dns";
import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";

import { isPublicAddress } from "./public-address";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export class UnsafeRequestError extends Error {
  override readonly name = "UnsafeRequestError";
}

interface SafeResponse {
  body: string;
}

/** Throws for anything it won't fetch or can't read. Never sends cookies or credentials. */
export type SafeGet = (url: string, options: { accept: string[] }) => Promise<SafeResponse>;

/**
 * Fetches a URL a user chose, protected against reaching our own network. Addresses are checked
 * inside `lookup`, at the moment of connecting, so a host can't pass a check and then rebind to a
 * private address. That's why this uses `node:http` rather than `fetch`.
 */
export function createSafeGet({
  isAddressAllowed = isPublicAddress,
  allowedPorts = ["", "80", "443"],
  maxRedirects = 3,
  timeoutMs = 5_000,
  maxBytes = 512 * 1024,
}: {
  isAddressAllowed?: (address: string) => boolean;
  allowedPorts?: string[];
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
} = {}): SafeGet {
  const checkedLookup: LookupFunction = (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error, "", 0);
        return;
      }

      const [first] = addresses;
      if (first === undefined || !addresses.every(({ address }) => isAddressAllowed(address))) {
        callback(new UnsafeRequestError("address"), "", 0);
        return;
      }

      if (options.all) {
        callback(null, addresses);
      } else {
        callback(null, first.address, first.family);
      }
    });
  };

  function assertSafe(url: URL) {
    const isWeb = url.protocol === "http:" || url.protocol === "https:";
    const hasCredentials = url.username !== "" || url.password !== "";
    const isLiteral = isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0;

    if (!isWeb || hasCredentials || isLiteral || !allowedPorts.includes(url.port)) {
      throw new UnsafeRequestError("url");
    }
  }

  function open(url: URL, accept: string[], signal: AbortSignal) {
    return new Promise<IncomingMessage>((resolve, reject) => {
      const send = url.protocol === "https:" ? httpsRequest : httpRequest;
      const request = send(
        url,
        {
          // A fresh connection every time, so each request goes through `checkedLookup`.
          agent: false,
          lookup: checkedLookup,
          signal,
          headers: {
            accept: accept.join(", "),
            "accept-encoding": "identity",
            "user-agent": "ScrollSparkBot/1.0",
          },
        },
        resolve,
      );

      request.on("error", reject);
      request.end();
    });
  }

  async function readBody(response: IncomingMessage) {
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of response as AsyncIterable<Buffer>) {
      chunks.push(chunk);
      size += chunk.length;
      // Enough to hold a page's head, and leaving the loop closes the connection.
      if (size >= maxBytes) {
        break;
      }
    }

    return Buffer.concat(chunks).subarray(0, maxBytes);
  }

  return async function safeGet(url, { accept }) {
    const signal = AbortSignal.timeout(timeoutMs);
    let current = new URL(url);

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      assertSafe(current);
      const response = await open(current, accept, signal);
      const { statusCode = 0, headers } = response;

      if (REDIRECT_STATUSES.has(statusCode) && headers.location !== undefined) {
        response.destroy();
        current = new URL(headers.location, current);
        continue;
      }

      const mediaType = headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? "";
      const encoding = headers["content-encoding"] ?? "identity";

      if (statusCode < 200 || statusCode >= 300 || !accept.includes(mediaType)) {
        response.destroy();
        throw new UnsafeRequestError("response");
      }

      if (encoding !== "identity") {
        response.destroy();
        throw new UnsafeRequestError("encoding");
      }

      return { body: new TextDecoder().decode(await readBody(response)) };
    }

    throw new UnsafeRequestError("redirects");
  };
}
