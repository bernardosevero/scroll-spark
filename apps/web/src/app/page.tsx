import { ConnectCard } from "@/features/connect/connect-card";
import { PingPanel } from "@/features/ping/ping-panel";
import { currentUserId } from "@/server/auth/current-user";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const { connect } = await searchParams;
  const userId = await currentUserId();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <h1 className="font-display text-6xl font-extrabold tracking-tight">Scroll Spark</h1>
      <ConnectCard isConnected={userId !== null} hasFailed={connect === "failed"} />
      <PingPanel />
    </main>
  );
}
