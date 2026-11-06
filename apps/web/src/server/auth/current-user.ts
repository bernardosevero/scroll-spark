import { cookies } from "next/headers";

import { getComposition } from "../composition";
import { SESSION_COOKIE, openSession } from "./session";

/** The signed-in user for this request, or null. */
export async function currentUserId() {
  // Read first, so a page using this is never prerendered, whatever the build's configuration.
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const { oauth } = getComposition();

  return oauth && openSession({ sealer: oauth.sessionSealer, cookie, now: oauth.now() });
}
