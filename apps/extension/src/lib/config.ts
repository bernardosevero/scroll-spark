import { webOriginFrom } from "./origins";

/**
 * The website and API this build talks to, set at build time with `WXT_API_ORIGIN`. A store build
 * points it at production. Without it, the build talks to the development site.
 */
export const WEB_ORIGIN = webOriginFrom(import.meta.env.WXT_API_ORIGIN as string | undefined);
