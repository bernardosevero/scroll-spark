import { PingPanel } from "@/features/ping/ping-panel";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <h1 className="font-display text-6xl font-extrabold tracking-tight">Scroll Spark</h1>
      <PingPanel />
    </main>
  );
}
