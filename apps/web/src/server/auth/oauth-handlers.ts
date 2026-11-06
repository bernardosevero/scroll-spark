import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type { AuthService } from "@scroll-spark/core/auth/auth.service";
import { pendingConnectSchema } from "@scroll-spark/core/auth/schemas";
import type { PendingConnect } from "@scroll-spark/core/auth/schemas";
import type { Logger } from "@scroll-spark/core/logging/logger";

import type { Sealer } from "../crypto/seal";
import { PENDING_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sealSession } from "./session";

const PENDING_MAX_AGE_SECONDS = 10 * 60;

export interface OAuthContext {
  auth: AuthService;
  sessionSealer: Sealer;
  pendingSealer: Sealer;
  logger: Logger;
  /** From configuration, never the request, so a forged Host header can't move the redirect. */
  appUrl: string;
  now: () => Date;
}

function cookieOptions(appUrl: string, maxAge: number) {
  return {
    httpOnly: true,
    // Lax, since Strict would drop the cookie on the redirect back from Buffer.
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    path: "/",
    maxAge,
  } as const;
}

const redirectUriFor = (appUrl: string) => `${appUrl}/api/auth/callback`;

function readPending(request: NextRequest, sealer: Sealer): PendingConnect | null {
  const cookie = request.cookies.get(PENDING_COOKIE)?.value;
  const opened = cookie === undefined ? null : sealer.open(cookie);

  if (opened === null) {
    return null;
  }

  const pending = pendingConnectSchema.safeParse(JSON.parse(opened));
  return pending.success ? pending.data : null;
}

export async function handleConnect({ auth, pendingSealer, appUrl }: OAuthContext) {
  const { authorizeUrl, pending } = await auth.beginConnect({
    redirectUri: redirectUriFor(appUrl),
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    PENDING_COOKIE,
    pendingSealer.seal(JSON.stringify(pending)),
    cookieOptions(appUrl, PENDING_MAX_AGE_SECONDS),
  );

  return response;
}

export async function handleCallback(request: NextRequest, context: OAuthContext) {
  const { auth, pendingSealer, sessionSealer, logger, appUrl, now } = context;
  const { searchParams } = request.nextUrl;

  let response: NextResponse;
  try {
    const { userId } = await auth.completeConnect({
      code: searchParams.get("code"),
      state: searchParams.get("state"),
      pending: readPending(request, pendingSealer),
      redirectUri: redirectUriFor(appUrl),
    });

    response = NextResponse.redirect(`${appUrl}/inbox`);
    response.cookies.set(
      SESSION_COOKIE,
      sealSession({ sealer: sessionSealer, userId, now: now() }),
      cookieOptions(appUrl, SESSION_MAX_AGE_SECONDS),
    );
  } catch (error) {
    logger.warn("auth.connect_failed", {
      reason: searchParams.get("error") ?? (error instanceof Error ? error.message : "unknown"),
    });
    response = NextResponse.redirect(`${appUrl}/?connect=failed`);
  }

  response.cookies.delete(PENDING_COOKIE);
  return response;
}

/** Ends the session. After the user's data is deleted, the landing page says so. */
export function handleDisconnect({ appUrl }: OAuthContext, { isDeleted = false } = {}) {
  // 303, so the browser follows this POST with a GET.
  const response = NextResponse.redirect(`${appUrl}/${isDeleted ? "?deleted=1" : ""}`, 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
