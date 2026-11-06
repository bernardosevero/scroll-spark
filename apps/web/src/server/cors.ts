/** The side panel calls the API across origins, so only our own extension is let in. */
export function allowedOrigin({
  origin,
  extensionOrigin,
  isDevelopment,
}: {
  origin: string | null;
  extensionOrigin: string | undefined;
  isDevelopment: boolean;
}): string | null {
  if (origin === null) {
    return null;
  }

  if (origin === extensionOrigin) {
    return origin;
  }

  // Unpacked extensions get a machine-specific ID until the manifest `key` is set.
  return isDevelopment && origin.startsWith("chrome-extension://") ? origin : null;
}

export function corsHeaders(origin: string | null): HeadersInit {
  if (origin === null) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type, authorization, trpc-accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}
