import { z } from "zod";

import type { Sealer } from "../crypto/seal";

export const SESSION_COOKIE = "ss_session";
export const PENDING_COOKIE = "ss_oauth_pending";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const sessionSchema = z.object({ userId: z.string().min(1), expiresAt: z.number() });

export function sealSession({
  sealer,
  userId,
  now,
}: {
  sealer: Sealer;
  userId: string;
  now: Date;
}) {
  return sealer.seal(
    JSON.stringify({ userId, expiresAt: now.getTime() + SESSION_MAX_AGE_SECONDS * 1000 }),
  );
}

/** The signed-in user, or null for a missing, forged or expired session. */
export function openSession({
  sealer,
  cookie,
  now,
}: {
  sealer: Sealer;
  cookie: string | undefined;
  now: Date;
}): string | null {
  const opened = cookie === undefined ? null : sealer.open(cookie);

  if (opened === null) {
    return null;
  }

  const session = sessionSchema.safeParse(JSON.parse(opened));

  return session.success && session.data.expiresAt > now.getTime() ? session.data.userId : null;
}
