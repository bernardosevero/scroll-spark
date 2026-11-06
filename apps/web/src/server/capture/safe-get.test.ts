import { createServer } from "node:http";
import type { RequestListener, Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { UnsafeRequestError, createSafeGet } from "./safe-get";

const HTML = { accept: ["text/html"] };

describe("safeGet", () => {
  let server: Server | undefined;

  afterEach(() => {
    server?.closeAllConnections();
    server?.close();
  });

  async function serve(handler: RequestListener) {
    server = createServer(handler);
    await new Promise<void>((resolve) => server?.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    return {
      url: `http://localhost:${port}`,
      /** Allows the test server, so the rest of the checks can be exercised. */
      get: (options: Parameters<typeof createSafeGet>[0] = {}) =>
        createSafeGet({ isAddressAllowed: () => true, allowedPorts: [String(port)], ...options }),
      port,
    };
  }

  const html = (body: string): RequestListener => {
    return (_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(body);
    };
  };

  it("returns a page's body, sending no credentials", async () => {
    const seen = vi.fn();
    const { url, get } = await serve((request, response) => {
      seen(request.headers);
      html("<title>Hello</title>")(request, response);
    });

    await expect(get()(url, HTML)).resolves.toEqual({ body: "<title>Hello</title>" });

    const headers = seen.mock.calls[0]?.[0] as Record<string, string>;
    expect(headers["user-agent"]).toBe("ScrollSparkBot/1.0");
    expect(headers["accept-encoding"]).toBe("identity");
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
  });

  it("refuses a name that resolves to a private address, at connection time", async () => {
    const seen = vi.fn();
    const { url, port } = await serve((_request, response) => {
      seen();
      response.end();
    });
    const get = createSafeGet({ allowedPorts: [String(port)] });

    await expect(get(url, HTML)).rejects.toThrow(UnsafeRequestError);
    expect(seen).not.toHaveBeenCalled();
  });

  it.each([
    ["loopback", "http://127.0.0.1/"],
    ["loopback as a number", "http://2130706433/"],
    ["loopback in hex", "http://0x7f.0.0.1/"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["IPv6 loopback", "http://[::1]/"],
    ["IPv4 written as IPv6", "http://[::ffff:127.0.0.1]/"],
    ["a public address, since every literal is refused", "http://8.8.8.8/"],
    ["an odd port", "http://example.org:8080/"],
    ["credentials", "https://user:secret@example.org/"],
    ["a file", "file:///etc/passwd"],
    ["FTP", "ftp://example.org/"],
  ])("refuses %s without connecting", async (_name, url) => {
    await expect(createSafeGet()(url, HTML)).rejects.toThrow(UnsafeRequestError);
  });

  it("follows up to 3 redirects", async () => {
    const { url, get } = await serve((request, response) => {
      const hop = Number(request.url?.slice(1) || 0);
      if (hop < 3) {
        response.writeHead(302, { location: `/${hop + 1}` });
        response.end();
        return;
      }
      html("arrived")(request, response);
    });

    await expect(get()(url, HTML)).resolves.toEqual({ body: "arrived" });
  });

  it("refuses a fourth redirect", async () => {
    const seen = vi.fn();
    const { url, get } = await serve((request, response) => {
      seen();
      const hop = Number(request.url?.slice(1) || 0);
      response.writeHead(302, { location: `/${hop + 1}` });
      response.end();
    });

    await expect(get()(url, HTML)).rejects.toThrow(UnsafeRequestError);
    expect(seen).toHaveBeenCalledTimes(4);
  });

  it.each([
    ["a private address", "http://169.254.169.254/latest/meta-data/"],
    ["a file", "file:///etc/passwd"],
    ["an odd port", "http://example.org:8080/"],
  ])("refuses a redirect to %s", async (_name, location) => {
    const { url, get } = await serve((_request, response) => {
      response.writeHead(302, { location });
      response.end();
    });

    await expect(get()(url, HTML)).rejects.toThrow(UnsafeRequestError);
  });

  it("stops waiting for a slow server", async () => {
    const { url, get } = await serve(() => undefined);

    await expect(get({ timeoutMs: 50 })(url, HTML)).rejects.toThrow();
  });

  it("reads only up to the limit of a huge page", async () => {
    const { url, get } = await serve((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.write("a".repeat(2_000));
      // Never ends, so this only finishes if the reader stops by itself.
    });

    const { body } = await get({ maxBytes: 1_000 })(url, HTML);

    expect(body).toHaveLength(1_000);
  });

  it.each([
    ["the wrong type", { "content-type": "application/pdf" }],
    ["no type", {}],
    ["a compressed body", { "content-type": "text/html", "content-encoding": "gzip" }],
  ])("refuses %s", async (_name, headers) => {
    const { url, get } = await serve((_request, response) => {
      response.writeHead(200, headers);
      response.end("x");
    });

    await expect(get()(url, HTML)).rejects.toThrow(UnsafeRequestError);
  });

  it("refuses an error page", async () => {
    const { url, get } = await serve((_request, response) => {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("Not here");
    });

    await expect(get()(url, HTML)).rejects.toThrow(UnsafeRequestError);
  });
});
