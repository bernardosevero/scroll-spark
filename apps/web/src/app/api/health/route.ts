import { checkHealth } from "@/server/health";

export async function GET() {
  const { isHealthy, database } = await checkHealth();

  return Response.json(
    { status: isHealthy ? "ok" : "error", database },
    {
      status: isHealthy ? 200 : 503,
    },
  );
}
