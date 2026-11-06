import { cookies } from "next/headers";

import { ConnectCard } from "@/features/connect/connect-card";
import { PingPanel } from "@/features/ping/ping-panel";
import { SESSION_COOKIE, openSession } from "@/server/auth/session";
import { getComposition } from "@/server/composition";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const { connect } = await searchParams;
  const { oauth } = getComposition();
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = oauth && openSession({ sealer: oauth.sessionSealer, cookie, now: oauth.now() });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <h1 className="font-display text-6xl font-extrabold tracking-tight">Scroll Spark</h1>
      <ConnectCard isConnected={Boolean(userId)} hasFailed={connect === "failed"} />
      <PingPanel />
    </main>
  );
}
