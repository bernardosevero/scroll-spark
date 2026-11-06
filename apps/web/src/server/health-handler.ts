import { createHash, timingSafeEqual } from "node:crypto";

import type { HealthService } from "@scroll-spark/core/health/health.service";

const HEADER = "x-health-secret";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Hashing first gives both sides one length, so the comparison reveals nothing about the secret. */
function isSameSecret(sent: string | null, secret: string) {
  return sent !== null && timingSafeEqual(digest(sent), digest(secret));
}

/**
 * Each call spends a little Claude and Buffer quota, so only the daily job may reach it. Without a
 * configured secret, the route doesn't exist.
 */
export async function handleDeepHealth(
  request: Request,
  { secret, health }: { secret: string | undefined; health: HealthService },
) {
  if (secret === undefined) {
    return new Response(null, { status: 404 });
  }

  if (!isSameSecret(request.headers.get(HEADER), secret)) {
    return new Response(null, { status: 401 });
  }

  const { isHealthy, checks } = await health.check();

  return Response.json(
    { status: isHealthy ? "ok" : "error", checks },
    {
      status: isHealthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
