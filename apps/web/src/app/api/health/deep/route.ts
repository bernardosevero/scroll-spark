import { getComposition } from "@/server/composition";
import { getEnv } from "@/server/env";
import { handleDeepHealth } from "@/server/health-handler";

export const maxDuration = 60;

export function GET(request: Request) {
  return handleDeepHealth(request, {
    secret: getEnv().HEALTH_SECRET,
    health: getComposition().health,
  });
}
