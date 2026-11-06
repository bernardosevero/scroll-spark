import type { NextRequest } from "next/server";

import { handleDisconnect } from "@/server/auth/oauth-handlers";
import { getComposition } from "@/server/composition";

export function POST(request: NextRequest) {
  const { oauth } = getComposition();
  const isDeleted = request.nextUrl.searchParams.get("deleted") === "1";

  return oauth ? handleDisconnect(oauth, { isDeleted }) : new Response(null, { status: 503 });
}
