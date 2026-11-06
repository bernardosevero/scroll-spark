import { handleDisconnect } from "@/server/auth/oauth-handlers";
import { getComposition } from "@/server/composition";

export function POST() {
  const { oauth } = getComposition();

  return oauth ? handleDisconnect(oauth) : new Response(null, { status: 503 });
}
