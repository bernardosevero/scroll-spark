import type { NextRequest } from "next/server";

import { handleCallback } from "@/server/auth/oauth-handlers";
import { getComposition } from "@/server/composition";

export function GET(request: NextRequest) {
  const { oauth } = getComposition();

  return oauth
    ? handleCallback(request, oauth)
    : new Response("Sign-in isn't configured.", { status: 503 });
}
