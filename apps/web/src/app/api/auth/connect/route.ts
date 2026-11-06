import { handleConnect } from "@/server/auth/oauth-handlers";
import { getComposition } from "@/server/composition";

export function GET() {
  const { oauth } = getComposition();

  return oauth ? handleConnect(oauth) : new Response("Sign-in isn't configured.", { status: 503 });
}
