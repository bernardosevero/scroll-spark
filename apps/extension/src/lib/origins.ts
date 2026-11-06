/** The development website, which runs over HTTPS because Buffer's OAuth requires it. */
export const LOCAL_ORIGIN = "https://localhost:3000";

/** Takes the build-time value, trims it, and falls back to the development website. */
export function webOriginFrom(value: string | undefined): string {
  const trimmed = value?.trim().replace(/\/+$/, "");
  return trimmed === undefined || trimmed === "" ? LOCAL_ORIGIN : trimmed;
}

/**
 * The websites allowed to hand this extension a sign-in token: the development site, and the
 * site the build talks to. Only HTTPS origins qualify, so a token never crosses plain HTTP.
 */
export function connectOrigins(webOrigin: string): string[] {
  const origins = new Set([LOCAL_ORIGIN]);

  if (new URL(webOrigin).protocol === "https:") {
    origins.add(new URL(webOrigin).origin);
  }

  return [...origins];
}
